import { useEffect, useRef, useState } from "react";

import {
	supportedExtensions,
	getFileExtension,
	createUploadId,
} from "../utils/uploadUtils";

export default function useUploadManager({
	defaultModelId,
	converterEndpoint,
	createDefaultSettings,
	setPositions,
	setModelSettings,
	setVisibleModelIds,
	setStatus,
}) {
	const [uploads, setUploads] = useState([]);
	const objectUrlsRef = useRef([]);

	useEffect(() => {
		return () => {
			objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
			objectUrlsRef.current = [];
		};
	}, []);

	const convertToGlb = async (file) => {
		const extension = getFileExtension(file.name);

		if (extension === "glb") {
			const url = URL.createObjectURL(file);
			objectUrlsRef.current.push(url);

			return {
				id: createUploadId(file, "glb"),
				name: file.name,
				url,
				isDefault: false,
				sourceExtension: "glb",
			};
		}

		const formData = new FormData();
		formData.append("file", file);

		const response = await fetch(converterEndpoint, {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			const message = await response.text();
			throw new Error(message || `Failed to convert ${file.name}`);
		}

		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		objectUrlsRef.current.push(url);

		return {
			id: createUploadId(file, "glb"),
			name: `${file.name.replace(/\.(step|stl)$/i, "")}.glb`,
			url,
			isDefault: false,
			sourceExtension: extension,
			convertedFrom: extension,
		};
	};

	const handleFileChange = async (event) => {
		const files = Array.from(event.target.files ?? []);
		event.target.value = "";

		if (!files.length) {
			return;
		}

		const validFiles = files.filter((file) => supportedExtensions.includes(getFileExtension(file.name)));
		const rejectedCount = files.length - validFiles.length;

		if (!validFiles.length) {
			setStatus("Unsupported file type. Use .glb, .stl, or .step.");
			return;
		}

		setStatus(`Converting ${validFiles.length} file${validFiles.length === 1 ? "" : "s"}...`);

		const results = await Promise.allSettled(validFiles.map((file) => convertToGlb(file)));
		const nextUploads = results
			.filter((result) => result.status === "fulfilled")
			.map((result) => result.value);
		const failedFiles = results
			.map((result, index) => ({ result, file: validFiles[index] }))
			.filter(({ result }) => result.status === "rejected");

		if (!nextUploads.length) {
			const firstFailure = failedFiles[0]?.result.reason?.message ?? "Conversion failed.";
			setStatus(firstFailure);
			return;
		}

		const uploadsCount = uploads.length;

		setUploads((currentUploads) => {
			const updated = [...currentUploads, ...nextUploads];
			// initialize positions for new uploads spaced along X
			setPositions((p) => {
				const next = { ...p };
				nextUploads.forEach((model, index) => {
					if (!next[model.id]) {
						const x = (currentUploads.length + index + 1) * 70;
						next[model.id] = [x, 0, 0];
					}
				});
				return next;
			});

			return updated;
		});
		setModelSettings((currentSettings) => {
			const nextSettings = { ...currentSettings };
			nextUploads.forEach((model, index) => {
				nextSettings[model.id] = createDefaultSettings(uploadsCount + index + 1);
			});
			return nextSettings;
		});
		setVisibleModelIds((currentVisibleIds) => {
			const nextVisibleIds = new Set(currentVisibleIds);

			if (nextVisibleIds.size === 1 && nextVisibleIds.has(defaultModelId)) {
				nextVisibleIds.delete(defaultModelId);
			}

			nextUploads.forEach((model) => nextVisibleIds.add(model.id));

			return nextVisibleIds;
		});

		const addedMessage =
			nextUploads.length === 1
				? `${nextUploads[0].convertedFrom ? `${nextUploads[0].convertedFrom.toUpperCase()} converted to GLB` : "GLB uploaded"}: ${nextUploads[0].name}.`
				: `${nextUploads.length} files ready for viewing.`;
		const rejectedMessage = rejectedCount ? ` ${rejectedCount} unsupported file(s) skipped.` : "";
		const failedMessage = failedFiles.length ? ` ${failedFiles.length} file(s) could not be converted.` : "";
		setStatus(`${addedMessage}${rejectedMessage}${failedMessage}`);
	};

	const releaseUploadUrl = (url, stillUsedUrls = []) => {
		const deletedUrls = new Set(objectUrlsRef.current.filter((currentUrl) => currentUrl === url));
		if (!deletedUrls.size) {
			return;
		}

		const stillUsedUrlsSet = new Set(stillUsedUrls);

		deletedUrls.forEach((deletedUrl) => {
			if (!stillUsedUrlsSet.has(deletedUrl)) {
				URL.revokeObjectURL(deletedUrl);
				objectUrlsRef.current = objectUrlsRef.current.filter((currentUrl) => currentUrl !== deletedUrl);
			}
		});
	};

	return {
		uploads,
		setUploads,
		objectUrlsRef,
		convertToGlb,
		handleFileChange,
		releaseUploadUrl,
	};
}
