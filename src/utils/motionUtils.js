export const defaultMotion = {
  type: "none",
  axis: "x",
  direction: "positive",
  speed: { value: 1, unit: "m/s" },
  amplitude: { value: 20, unit: "m" },
};

export function createMotionParameter(value, unit) {
  return { value, unit };
}

export function getSpeedUnitOptions(type) {
  if (type === "rotation") {
    return ["rpm", "rps", "deg/s", "rad/s"];
  }

  if (type === "oscillation") {
    return ["m/s", "cm/s", "mm/s"];
  }

  return ["m/s", "cm/s", "mm/s"];
}

export function getAmplitudeUnitOptions() {
  return ["m", "cm", "mm"];
}

export function normalizeMotionParameter(parameter, fallbackValue, fallbackUnit, allowedUnits) {
  if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
    const nextValue = Number(parameter.value);
    return {
      value: Number.isFinite(nextValue) ? nextValue : fallbackValue,
      unit: allowedUnits.includes(parameter.unit) ? parameter.unit : fallbackUnit,
    };
  }

  const nextValue = Number(parameter);
  return createMotionParameter(Number.isFinite(nextValue) ? nextValue : fallbackValue, fallbackUnit);
}

export function normalizeMotionDraft(motion = {}) {
  const type = motion.type ?? defaultMotion.type;
  const speedUnit = type === "rotation" ? "rpm" : "m/s";

  return {
    ...defaultMotion,
    ...motion,
    type,
    axis: motion.axis ?? defaultMotion.axis,
    direction: motion.direction ?? defaultMotion.direction,
    speed: normalizeMotionParameter(motion.speed, defaultMotion.speed.value, speedUnit, getSpeedUnitOptions(type)),
    amplitude: normalizeMotionParameter(motion.amplitude, defaultMotion.amplitude.value, "m", getAmplitudeUnitOptions()),
  };
}

export function convertSpeedToBaseUnits(speed, type) {
  const value = Number(speed?.value ?? speed ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  const unit = speed?.unit ?? "m/s";

  if (type === "translation") {
    if (unit === "cm/s") return value / 100;
    if (unit === "mm/s") return value / 1000;
    return value;
  }

  if (unit === "deg/s") return (value * Math.PI) / 180;
  if (unit === "rpm") return (value * 2 * Math.PI) / 60;
  if (unit === "rps") return value * 2 * Math.PI;
  return value;
}

export function convertAmplitudeToBaseUnits(amplitude) {
  const value = Number(amplitude?.value ?? amplitude ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  const unit = amplitude?.unit ?? "m";

  if (unit === "cm") return value / 100;
  if (unit === "mm") return value / 1000;
  return value;
}

export function toRuntimeMotion(motion = {}) {
  const normalized = normalizeMotionDraft(motion);

  if (normalized.type === "translation") {
    const amplitude = convertAmplitudeToBaseUnits(normalized.amplitude);
    const speed = convertSpeedToBaseUnits(normalized.speed, normalized.type);

    return {
      ...normalized,
      speed: amplitude > 0 ? speed / amplitude : 0,
      amplitude,
    };
  }

  return {
    ...normalized,
    speed: convertSpeedToBaseUnits(normalized.speed, normalized.type),
    amplitude: convertAmplitudeToBaseUnits(normalized.amplitude),
  };
}




