import { useState } from "react";

import { defaultMotion, normalizeMotionDraft } from "../utils/motionUtils";
import {
	compactParameterDrafts,
	createDefaultSettings,
	normalizeModelId,
	normalizeParameterDrafts,
} from "../utils/modelUtils";

export default function useInspector({
	modelSettings,
	setModelSettings,
	setStatus,
	getModelName,
}) {
	const [inspectorModelId, setInspectorModelId] = useState(null);
	const [inspectorDraft, setInspectorDraft] = useState(null);
	const [inspectorTab, setInspectorTab] = useState(null);

	const openInspector = (modelId) => {
		const normalizedModelId = normalizeModelId(modelId);
		const settings = modelSettings[normalizedModelId] ?? createDefaultSettings();

		setInspectorModelId(normalizedModelId);
		setInspectorTab(null);
		setInspectorDraft({
			color: settings.color,
			motion: normalizeMotionDraft(settings.motion),
			parameters: normalizeParameterDrafts(settings.parameters),
		});
	};

	const closeInspector = () => {
		setInspectorModelId(null);
		setInspectorDraft(null);
		setInspectorTab(null);
	};

	const updateInspectorDraft = (patch) => {
		const hasParameters = Object.prototype.hasOwnProperty.call(patch, "parameters");

		setInspectorDraft((current) => ({
			...current,
			...patch,
			motion: patch.motion ? normalizeMotionDraft({ ...(current?.motion ?? defaultMotion), ...patch.motion }) : current?.motion ?? defaultMotion,
			parameters: hasParameters ? normalizeParameterDrafts(patch.parameters) : current?.parameters ?? [],
		}));
	};

	const saveInspector = () => {
		if (!inspectorModelId || !inspectorDraft) {
			closeInspector();
			return;
		}

		const nextMotion = normalizeMotionDraft(inspectorDraft.motion ?? defaultMotion);
		const nextSettings = {
			color: inspectorDraft.color,
			motion: nextMotion,
			parameters: compactParameterDrafts(inspectorDraft.parameters ?? []),
		};

		setModelSettings((currentSettings) => ({
			...currentSettings,
			[inspectorModelId]: nextSettings,
		}));

		setStatus(`Updated ${getModelName(inspectorModelId) ?? "model"}.`);
		closeInspector();
	};

	const saveInspectorParameters = (parameters = []) => {
		if (!inspectorModelId) {
			return;
		}

		const nextParameters = compactParameterDrafts(parameters);
		const modelName = getModelName(inspectorModelId) ?? "model";

		setInspectorDraft((current) =>
			current
				? {
						...current,
						parameters: normalizeParameterDrafts(nextParameters),
					}
				: current,
		);

		setModelSettings((currentSettings) => ({
			...currentSettings,
			[inspectorModelId]: {
				...(currentSettings[inspectorModelId] ?? createDefaultSettings()),
				parameters: nextParameters,
			},
		}));

		setStatus(`Saved parameters for ${modelName}.`);
		setInspectorTab("motion");
	};

	return {
		inspectorModelId,
		inspectorDraft,
		inspectorTab,
		setInspectorTab,
		openInspector,
		closeInspector,
		updateInspectorDraft,
		saveInspector,
		saveInspectorParameters,
	};
}
