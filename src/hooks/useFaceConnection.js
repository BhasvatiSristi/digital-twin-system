import { useState } from "react";
import * as THREE from "three";

export default function useFaceConnection({
	setSelectedModelId,
	setStatus,
	focusOn,
	getModelPose,
	applySubtreeTransform,
}) {
	const [faceSelection, setFaceSelection] = useState(null);
	const [faceConnectMode, setFaceConnectMode] = useState(false);

	const clearFaceSelection = () => {
		setFaceSelection(null);
		setFaceConnectMode(false);
	};

	const applyFaceSnap = (sourcePick, targetPick) => {
		if (!sourcePick || !targetPick) {
			return;
		}

		if (sourcePick.modelId === targetPick.modelId) {
			setStatus("Pick a face on a different part.");
			return;
		}

		const sourcePose = getModelPose(sourcePick.modelId);
		const targetPose = getModelPose(targetPick.modelId);

		const sourceWorldNormal = sourcePick.localNormal.clone().applyQuaternion(sourcePose.quaternion).normalize();
		const targetWorldNormal = targetPick.localNormal.clone().applyQuaternion(targetPose.quaternion).normalize();
		const snapQuaternion = new THREE.Quaternion().setFromUnitVectors(sourceWorldNormal, targetWorldNormal.clone().negate());

		const nextQuaternion = snapQuaternion.multiply(sourcePose.quaternion.clone()).normalize();
		const targetWorldPoint = targetPick.localPoint.clone().applyQuaternion(targetPose.quaternion).add(targetPose.position);
		const sourcePointAfterRotation = sourcePick.localPoint.clone().applyQuaternion(nextQuaternion);
		const nextPosition = targetWorldPoint.sub(sourcePointAfterRotation);

		applySubtreeTransform(sourcePick.modelId, nextPosition, nextQuaternion);

		setStatus(`Aligned ${sourcePick.modelId} to ${targetPick.modelId}.`);
		focusOn(nextPosition);
		clearFaceSelection();
	};

	const selectSourceFace = (facePick) => {
		setFaceSelection({
			phase: "waiting-for-target",
			source: facePick,
			target: null,
		});
		setSelectedModelId(facePick.modelId);
		setStatus("Select the next face to connect.");
		focusOn(facePick.worldPoint ?? facePick.localPoint ?? [0, 0, 0]);
	};

	const startFaceConnection = () => {
		setFaceConnectMode(true);

		setFaceSelection({
			phase: "waiting-for-source",
			source: null,
			target: null,
		});

		setStatus("Click the SOURCE face.");
	};

	const handleFaceClick = (facePick) => {
		if (!faceConnectMode || !facePick?.modelId) {
			return;
		}

		if (faceSelection?.phase === "waiting-for-source") {
			selectSourceFace(facePick);
			setStatus("Source selected. Click the TARGET face.");
			return;
		}

		if (faceSelection?.phase === "waiting-for-target") {
			applyFaceSnap(faceSelection.source, facePick);
		}
	};

	return {
		faceSelection,
		faceConnectMode,
		startFaceConnection,
		clearFaceSelection,
		handleFaceClick,
		applyFaceSnap,
		selectSourceFace,
	};
}
