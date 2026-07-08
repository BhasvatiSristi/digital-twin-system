const WARNING_LIMIT = 80;
const CRITICAL_LIMIT = 100;

export const getForceBasedColor = (settings) => {
  const force = settings.parameters?.find(
        (p) => p.name?.trim().toLowerCase() === "force"
    );

    if (!force) {
        return settings.color;
    }

    const value = Number(force.value);

    if (value >= CRITICAL_LIMIT) {
        return "#ff6b6b";
    }

    if (value >= WARNING_LIMIT) {
        return "#ff9fbf";
    }

    return settings.color;
};

export const isForceCritical = (settings) => {
    const force = settings.parameters?.find(
        (p) => p.name?.trim().toLowerCase() === "force"
    );

    if (!force) return false;

    return Number(force.value) >= 100;
};