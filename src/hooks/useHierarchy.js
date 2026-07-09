import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import {
	collectDescendantIds,
	quaternionFromArray,
	vectorFromArray,
} from "../utils/modelUtils";

export default function useHierarchy({
	positions,
	rotations,
	setPositions,
	setRotations,
	setSelectedModelId,
	setStatus,
	getModelName,
	closeInspector,
}) {
	const [attachmentParentByChild, setAttachmentParentByChild] = useState({});
	const [selectionModeActive, setSelectionModeActive] = useState(false);
	const [selectionDraftIds, setSelectionDraftIds] = useState([]);
	const [joinDialog, setJoinDialog] = useState(null);

	const attachmentChildrenByParent = useMemo(() => {
		const map = {};

		Object.entries(attachmentParentByChild).forEach(([childId, parentId]) => {
			if (!map[parentId]) {
				map[parentId] = [];
			}
			map[parentId].push(childId);
		});

		return map;
	}, [attachmentParentByChild]);

	const resetJoinSelection = () => {
		setSelectionModeActive(false);
		setSelectionDraftIds([]);
		setJoinDialog(null);
	};

	const closeJoinDialog = () => {
		setJoinDialog(null);
	};

	const openJoinDialogFromSelection = () => {
		if (!selectionModeActive || selectionDraftIds.length < 2) {
			setStatus("Select at least two parts before joining.");
			return;
		}

		const uniquePartIds = [...new Set(selectionDraftIds)];
		setJoinDialog({
			partIds: uniquePartIds,
			parentId: uniquePartIds[0],
			childId: uniquePartIds[1] ?? uniquePartIds[0],
		});
		setStatus("Choose the parent and child, then confirm the join.");
	};

	const startJoinSelection = () => {
		setSelectionModeActive(true);
		setSelectionDraftIds([]);
		setSelectedModelId(null);
		setJoinDialog(null);
		setStatus("Click two or more parts to join, then press Enter to choose parent and child.");
		closeInspector();
	};

	const applySubtreeTransform = (rootId, nextRootPosition, nextRootQuaternion) => {
		const oldRootPosition = vectorFromArray(positions[rootId] ?? [0, 0, 0]);
		const oldRootQuaternion = quaternionFromArray(rotations[rootId] ?? [0, 0, 0, 1]);
		const rootInverseQuaternion = oldRootQuaternion.clone().invert();
		const affectedIds = [rootId, ...collectDescendantIds(rootId, attachmentChildrenByParent)];

		setPositions((currentPositions) => {
			const nextPositions = { ...currentPositions };

			affectedIds.forEach((modelId) => {
				if (modelId === rootId) {
					nextPositions[modelId] = [nextRootPosition.x, nextRootPosition.y, nextRootPosition.z];
					return;
				}

				const currentPosition = vectorFromArray(currentPositions[modelId] ?? [0, 0, 0]);
				const relativePosition = currentPosition.clone().sub(oldRootPosition).applyQuaternion(rootInverseQuaternion.clone());
				const nextPosition = relativePosition.applyQuaternion(nextRootQuaternion.clone()).add(nextRootPosition);
				nextPositions[modelId] = [nextPosition.x, nextPosition.y, nextPosition.z];
			});

			return nextPositions;
		});

		setRotations((currentRotations) => {
			const nextRotations = { ...currentRotations };

			affectedIds.forEach((modelId) => {
				if (modelId === rootId) {
					nextRotations[modelId] = [nextRootQuaternion.x, nextRootQuaternion.y, nextRootQuaternion.z, nextRootQuaternion.w];
					return;
				}

				const currentQuaternion = quaternionFromArray(currentRotations[modelId] ?? [0, 0, 0, 1]);
				const relativeQuaternion = rootInverseQuaternion.clone().multiply(currentQuaternion);
				const nextQuaternion = nextRootQuaternion.clone().multiply(relativeQuaternion).normalize();
				nextRotations[modelId] = [nextQuaternion.x, nextQuaternion.y, nextQuaternion.z, nextQuaternion.w];
			});

			return nextRotations;
		});
	};

	const getModelLocalPose = (modelId) => {
		const worldPosition = vectorFromArray(positions[modelId] ?? [0, 0, 0]);
		const worldQuaternion = quaternionFromArray(rotations[modelId] ?? [0, 0, 0, 1]);
		const parentId = attachmentParentByChild[modelId];

		if (!parentId) {
			return {
				position: [worldPosition.x, worldPosition.y, worldPosition.z],
				quaternion: [worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w],
			};
		}

		const parentWorldPosition = vectorFromArray(positions[parentId] ?? [0, 0, 0]);
		const parentWorldQuaternion = quaternionFromArray(rotations[parentId] ?? [0, 0, 0, 1]);
		const parentInverseQuaternion = parentWorldQuaternion.clone().invert();

		const localPosition = worldPosition.clone().sub(parentWorldPosition).applyQuaternion(parentInverseQuaternion);
		const localQuaternion = parentInverseQuaternion.multiply(worldQuaternion).normalize();

		return {
			position: [localPosition.x, localPosition.y, localPosition.z],
			quaternion: [localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w],
		};
	};

	const getMoveTargets = (modelId) => {
		return [modelId, ...collectDescendantIds(modelId, attachmentChildrenByParent)];
	};

	const handleJoinSelectionToggle = (modelId) => {
		const normalizedModelId = modelId;

		setSelectionDraftIds((current) => {
			const next = current.includes(normalizedModelId)
				? current.filter((id) => id !== normalizedModelId)
				: [...current, normalizedModelId];

			setSelectedModelId(normalizedModelId);
			setStatus(`${next.length} part${next.length === 1 ? "" : "s"} selected for joining. Press Enter to choose parent and child.`);
			return next;
		});
	};

	const handleJoinSelectionChange = (kind, modelId) => {
		setJoinDialog((current) => ({
			...(current ?? {}),
			[kind]: modelId,
		}));
	};

	const confirmJoinSelection = () => {
		if (!joinDialog) {
			return;
		}

		const parentId = joinDialog.parentId;
		const childId = joinDialog.childId;
		const selectedPartIds = joinDialog.partIds ?? [];

		if (!selectedPartIds.includes(parentId) || !selectedPartIds.includes(childId)) {
			setStatus("Choose both parent and child from the selected parts.");
			return;
		}

		if (parentId === childId) {
			setStatus("Choose two different parts for the join.");
			return;
		}

		const childDescendants = collectDescendantIds(childId, attachmentChildrenByParent);
		if (childDescendants.includes(parentId)) {
			setStatus("Choose a parent that is not inside the child subtree.");
			return;
		}

		setAttachmentParentByChild((current) => ({
			...current,
			[childId]: parentId,
		}));
		setSelectedModelId(parentId);
		resetJoinSelection();

		const parentName = getModelName(parentId) ?? parentId;
		const childName = getModelName(childId) ?? childId;
		setStatus(`Joined ${childName} under ${parentName}. Parent motion now carries the child.`);
	};

	const handleInspectorTabChange = (tab) => {
		if (tab !== "select") {
			setSelectionDraftIds([]);
			setSelectionModeActive(false);
			setJoinDialog(null);
		}
	};

	const cleanupHierarchyForDeletedModel = (modelId) => {
		setAttachmentParentByChild((currentAttachments) => {
			const nextAttachments = {};

			Object.entries(currentAttachments).forEach(([childId, parentId]) => {
				if (childId === modelId || parentId === modelId) {
					return;
				}

				nextAttachments[childId] = parentId;
			});

			return nextAttachments;
		});

		setSelectionDraftIds((currentSelection) => currentSelection.filter((id) => id !== modelId));
		setJoinDialog((currentJoinDialog) => {
			if (!currentJoinDialog) return currentJoinDialog;
			if (currentJoinDialog.partIds?.includes(modelId) || currentJoinDialog.parentId === modelId || currentJoinDialog.childId === modelId) {
				return null;
			}

			return currentJoinDialog;
		});
	};

	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.key !== "Enter" || !selectionModeActive || !selectionDraftIds.length) {
				return;
			}

			event.preventDefault();
			openJoinDialogFromSelection();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectionDraftIds, selectionModeActive]);

	return {
		attachmentParentByChild,
		attachmentChildrenByParent,
		selectionModeActive,
		selectionDraftIds,
		joinDialog,
		startJoinSelection,
		openJoinDialogFromSelection,
		closeJoinDialog,
		resetJoinSelection,
		applySubtreeTransform,
		confirmJoinSelection,
		handleJoinSelectionChange,
		getMoveTargets,
		handleJoinSelectionToggle,
		getModelLocalPose,
		handleInspectorTabChange,
		cleanupHierarchyForDeletedModel,
	};
}
