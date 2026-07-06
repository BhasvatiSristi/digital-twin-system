import { Center, Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function GltfModel({ url, color = "#cfd8dc" }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf?.scene?.clone(true), [gltf]);

  useEffect(() => {
  if (!scene) return;

  scene.traverse((child) => {
    if (!child.isMesh) return;

    if (child.material)
      child.material = child.material.clone();

    child.material.color.set(color);
    child.material.metalness = 0.9;
    child.material.roughness = 0.25;
    child.material.envMapIntensity = 1;
    child.material.specularIntensity =
      child.material.specularIntensity ?? 0.5;
  });
}, [scene, color]);

  if (!scene) {
    return null;
  }

  return (
    <Center>
      <primitive object={scene} scale={0.6} />
    </Center>
  );
}

function getFaceTriangle(geometry, faceIndex) {
  const positionAttribute = geometry.attributes.position;
  const indexAttribute = geometry.index;
  const triangleIndex = faceIndex * 3;

  if (triangleIndex < 0 || triangleIndex + 2 >= (indexAttribute ? indexAttribute.count : positionAttribute.count)) {
    return null;
  }

  const vertexA = new THREE.Vector3();
  const vertexB = new THREE.Vector3();
  const vertexC = new THREE.Vector3();

  const readVertex = (target, attributeIndex) => {
    target.fromBufferAttribute(positionAttribute, attributeIndex);
  };

  if (indexAttribute) {
    readVertex(vertexA, indexAttribute.getX(triangleIndex));
    readVertex(vertexB, indexAttribute.getX(triangleIndex + 1));
    readVertex(vertexC, indexAttribute.getX(triangleIndex + 2));
  } else {
    readVertex(vertexA, triangleIndex);
    readVertex(vertexB, triangleIndex + 1);
    readVertex(vertexC, triangleIndex + 2);
  }

  const centroid = vertexA.clone().add(vertexB).add(vertexC).multiplyScalar(1 / 3);
  const normal = vertexB.clone().sub(vertexA).cross(vertexC.clone().sub(vertexA)).normalize();

  return { centroid, normal };
}

function FaceMarker({ point, normal }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!markerRef.current || !point || !normal) return;

    markerRef.current.position.copy(point).add(normal.clone().normalize().multiplyScalar(0.35));
    markerRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  }, [point, normal]);

  return (
    <mesh ref={markerRef} renderOrder={20}>
      <circleGeometry args={[2.5, 24]} />
      <meshBasicMaterial color="#84b7ff" transparent opacity={0.65} depthWrite={false} />
    </mesh>
  );
}

function FaceSelectionMarker({ faceSelection, modelId }) {
  if (!faceSelection || faceSelection.source?.modelId !== modelId) {
    return null;
  }

  return <FaceMarker point={faceSelection.source.localPoint} normal={faceSelection.source.localNormal} />;
}

function toLocalFacePick({ modelId, rootObject, point, normal, meshName, meshUuid, faceIndex }) {
  const localPoint = rootObject.worldToLocal(point.clone());
  const inverseNormalMatrix = new THREE.Matrix3().getNormalMatrix(rootObject.matrixWorld);
  const localNormal = normal.clone().applyMatrix3(inverseNormalMatrix).normalize();

  return {
    modelId,
    meshUuid: meshUuid ?? null,
    meshName: meshName ?? null,
    faceIndex,
    worldPoint: point.clone(),
    worldNormal: normal.clone().normalize(),
    localPoint,
    localNormal,
  };
}

function toWorldFaceNormal(mesh, localNormal) {
  const worldNormal = localNormal.clone();
  worldNormal.transformDirection(mesh.matrixWorld).normalize();
  return worldNormal;
}

function WarningIndicator({ visible }) {
  const iconRef = useRef();

  useFrame(({ clock }) => {
    if (!iconRef.current) return;

    const blink =
      Math.floor(clock.getElapsedTime() * 2) % 2 === 0;

    iconRef.current.style.opacity =
      visible && blink ? "1" : "0.2";
  });

  if (!visible) return null;

  return (
    <Html position={[0, 45, 0]} center>
      <div
        ref={iconRef}
        style={{
          fontSize: "34px",
          userSelect: "none",
          pointerEvents: "none",
          transition: "opacity 0.15s linear",
          filter: "drop-shadow(0 0 10px red)",
        }}
      >
        ⚠️
      </div>
    </Html>
  );
}

export default function CadModel({
  id,
  url,
  position = [0, 0, 0],
  quaternion = [0, 0, 0, 1],
  color,
  isCritical=false,
  motion,
  selected,
  onSelect,
  onTap,
  onEdit,
  onMove,
  onFaceDoubleClick,
  onFaceClick,
  faceSelection,
  children,
}) {
  const groupRef = useRef(null);
  const meshRef = useRef(null);

  const effectiveColor = useMemo(() => {
    const base = new THREE.Color(color ?? "#cfd8dc");
    return selected ? base.multiplyScalar(0.52) : base;
  }, [color, selected]);

  const axisVector = useMemo(() => {
    if (motion?.axis === "y") return new THREE.Vector3(0, 1, 0);
    if (motion?.axis === "z") return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(1, 0, 0);
  }, [motion?.axis]);

  const directionSign = useMemo(() => {
    return motion?.direction === "negative" || motion?.direction === "anticlockwise" ? -1 : 1;
  }, [motion?.direction]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const basePosition = new THREE.Vector3(...position);
    const baseQuaternion = new THREE.Quaternion(...quaternion);
    const elapsedTime = clock.getElapsedTime();
    const animatedOffset = new THREE.Vector3();
    const hasChildren = Boolean(children);

    // Always reset mesh local transform each frame so it's predictable
    if (meshRef.current) {
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.quaternion.set(0, 0, 0, 1);
    }

    // Default: outer group carries base pose
    groupRef.current.quaternion.copy(baseQuaternion);

    if (motion?.type === "translation") {
      const travel = (motion.amplitude ?? 20) * ((elapsedTime * (motion.speed ?? 1)) % 1);
      animatedOffset.copy(axisVector).multiplyScalar(travel * directionSign);

      if (hasChildren) {
        // apply translation to outer group so children follow
        groupRef.current.position.copy(basePosition.clone().add(animatedOffset));
      } else if (meshRef.current) {
        // apply translation only to this mesh, leaving children unaffected
        meshRef.current.position.copy(animatedOffset);
        groupRef.current.position.copy(basePosition);
      } else {
        groupRef.current.position.copy(basePosition.clone().add(animatedOffset));
      }
    } else if (motion?.type === "oscillation") {
      const travel = Math.sin(elapsedTime * (motion.speed ?? 1)) * (motion.amplitude ?? 20);
      animatedOffset.copy(axisVector).multiplyScalar(travel * directionSign);

      if (hasChildren) {
        groupRef.current.position.copy(basePosition.clone().add(animatedOffset));
      } else if (meshRef.current) {
        meshRef.current.position.copy(animatedOffset);
        groupRef.current.position.copy(basePosition);
      } else {
        groupRef.current.position.copy(basePosition.clone().add(animatedOffset));
      }
    } else if (motion?.type === "rotation") {
      if (hasChildren) {
        // apply rotation to outer group so children inherit the rotation
        groupRef.current.quaternion.copy(baseQuaternion);
        groupRef.current.rotateOnAxis(axisVector, elapsedTime * (motion.speed ?? 1) * directionSign);
        groupRef.current.position.copy(basePosition);
      } else if (meshRef.current) {
        // apply rotation only to mesh so children (if any) won't rotate
        meshRef.current.quaternion.set(0, 0, 0, 1);
        meshRef.current.rotateOnAxis(axisVector, elapsedTime * (motion.speed ?? 1) * directionSign);
        groupRef.current.position.copy(basePosition);
      } else {
        groupRef.current.quaternion.copy(baseQuaternion);
        groupRef.current.rotateOnAxis(axisVector, elapsedTime * (motion.speed ?? 1) * directionSign);
        groupRef.current.position.copy(basePosition);
      }
    } else {
      // no motion: just keep base pose
      groupRef.current.position.copy(basePosition);
    }

  });

  const handleDoubleClick = (event) => {
    event.stopPropagation();
    onSelect?.(id);

    if (faceSelection?.phase !== "waiting-for-target") {
      onTap?.(id);
      return;
    }

    const mesh = event.object;
    if (!mesh?.isMesh || event.faceIndex == null) {
      return;
    }

    mesh.updateWorldMatrix?.(true, false);
    const faceData = getFaceTriangle(mesh.geometry, event.faceIndex);
    if (!faceData) {
      return;
    }

    const worldNormal = event.face?.normal ? toWorldFaceNormal(mesh, event.face.normal) : faceData.normal.clone().transformDirection(mesh.matrixWorld).normalize();

    const pick = toLocalFacePick({
      modelId: id,
      rootObject: groupRef.current ?? mesh,
      faceIndex: event.faceIndex,
      point: event.point ?? faceData.centroid,
      normal: worldNormal,
      meshName: mesh.name ?? null,
      meshUuid: mesh.uuid,
    });

    onFaceDoubleClick?.(pick);
  };

  const handleClick = (event) => {
    event.stopPropagation();
    onSelect?.(id);

    if (faceSelection?.phase !== "waiting-for-target") {
      return;
    }

    const mesh = event.object;
    if (!mesh?.isMesh || event.faceIndex == null) {
      return;
    }

    mesh.updateWorldMatrix?.(true, false);
    const faceData = getFaceTriangle(mesh.geometry, event.faceIndex);
    if (!faceData) {
      return;
    }

    const worldNormal = event.face?.normal ? toWorldFaceNormal(mesh, event.face.normal) : faceData.normal.clone().transformDirection(mesh.matrixWorld).normalize();

    const pick = toLocalFacePick({
      modelId: id,
      rootObject: groupRef.current ?? mesh,
      faceIndex: event.faceIndex,
      point: event.point ?? faceData.centroid,
      normal: worldNormal,
      meshName: mesh.name ?? null,
      meshUuid: mesh.uuid,
    });

    onFaceClick?.(pick);
  };

  const commonHandlers = {
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    onContextMenu: (e) => {
      e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
      onSelect?.(id);
      onEdit?.(id);
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e) => {
      e.stopPropagation();
      document.body.style.cursor = "default";
    },
  };

  return (
    <group ref={groupRef} position={position} {...commonHandlers}>
      <group ref={meshRef}>
        <GltfModel
            url={url}
            color={effectiveColor}
        />

        <WarningIndicator
            visible={isCritical}
        />

        <FaceSelectionMarker
            faceSelection={faceSelection}
            modelId={id}
        />
      </group>
      {children}
    </group>
  );
}
