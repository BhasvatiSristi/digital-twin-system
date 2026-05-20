import { Center, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function GltfModel({ url, color = "#cfd8dc" }) {
  const gltf = useGLTF(url);

  useEffect(() => {
    if (!gltf?.scene) return;
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        if (child.material) child.material = child.material.clone();
        child.material.color = new THREE.Color(color);
        child.material.metalness = child.material.metalness ?? 0.15;
        child.material.roughness = child.material.roughness ?? 0.8;
      }
    });
  }, [gltf, color]);

  if (!gltf?.scene) {
    return null;
  }

  return (
    <Center>
      <primitive object={gltf.scene} scale={0.6} />
    </Center>
  );
}

export default function CadModel({ id, url, position = [0, 0, 0], color, motion, selected, onSelect, onEdit, onMove }) {
  const groupRef = useRef(null);
  const dragState = useRef({
    dragging: false,
    plane: new THREE.Plane(),
    grabOffset: new THREE.Vector3(),
    hitPoint: new THREE.Vector3(),
  });

  const effectiveColor = useMemo(() => {
    const base = new THREE.Color(color ?? "#cfd8dc");
    return selected ? base.multiplyScalar(0.45) : base;
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
    const elapsedTime = clock.getElapsedTime();
    const animatedOffset = new THREE.Vector3();

    if (motion?.type === "translation") {
      const travel = (motion.amplitude ?? 20) * ((elapsedTime * (motion.speed ?? 1)) % 1);
      animatedOffset.copy(axisVector).multiplyScalar(travel * directionSign);
      groupRef.current.rotation.set(0, 0, 0);
    } else if (motion?.type === "oscillation") {
      const travel = Math.sin(elapsedTime * (motion.speed ?? 1)) * (motion.amplitude ?? 20);
      animatedOffset.copy(axisVector).multiplyScalar(travel * directionSign);
      groupRef.current.rotation.set(0, 0, 0);
    } else if (motion?.type === "rotation") {
      groupRef.current.rotation.set(0, 0, 0);
      groupRef.current.rotateOnAxis(axisVector, elapsedTime * (motion.speed ?? 1) * directionSign);
    } else {
      groupRef.current.rotation.set(0, 0, 0);
    }

    groupRef.current.position.copy(basePosition.add(animatedOffset));
  });

  const beginDrag = (event) => {
    event.stopPropagation();
    onSelect?.(id);

    const objectPosition = groupRef.current?.position.clone() ?? new THREE.Vector3(...position);
    // Lock drag to XZ plane (Y up) so movement occurs on two axes only
    const planeNormal = new THREE.Vector3(0, 1, 0);
    dragState.current.plane.setFromNormalAndCoplanarPoint(planeNormal, objectPosition);
    dragState.current.dragging = true;
    dragState.current.grabOffset.copy(event.point).sub(objectPosition);
    dragState.current.baseY = objectPosition.y;

    if (event.target?.setPointerCapture) {
      event.target.setPointerCapture(event.pointerId);
    }
    document.body.style.cursor = "grabbing";
  };

  const moveDrag = (event) => {
    if (!dragState.current.dragging) return;

    event.stopPropagation();
    if (event.ray.intersectPlane(dragState.current.plane, dragState.current.hitPoint)) {
      const nextPosition = dragState.current.hitPoint.clone().sub(dragState.current.grabOffset);
      // keep Y locked to the original object's Y so movement is only on X and Z
      nextPosition.y = dragState.current.baseY ?? nextPosition.y;
      onMove?.(id, [nextPosition.x, nextPosition.y, nextPosition.z]);
    }
  };

  const endDrag = (event) => {
    if (!dragState.current.dragging) return;

    event.stopPropagation();
    dragState.current.dragging = false;
    document.body.style.cursor = "default";

    if (event.target?.releasePointerCapture) {
      event.target.releasePointerCapture(event.pointerId);
    }
  };

  const commonHandlers = {
    onPointerDown: beginDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onContextMenu: (e) => {
      e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
      onSelect?.(id);
      onEdit?.(id);
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      if (!dragState.current.dragging) {
        document.body.style.cursor = "pointer";
      }
    },
    onPointerOut: (e) => {
      e.stopPropagation();
      if (!dragState.current.dragging) {
        document.body.style.cursor = "default";
      }
    },
  };

  return (
    <group ref={groupRef} position={position} {...commonHandlers}>
      <GltfModel url={url} color={effectiveColor} />
    </group>
  );
}