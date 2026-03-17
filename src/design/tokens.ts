export const tokens = {
  color: {
    brand: {
      navy: "#0A1F44",
      blue: "#1E4EDF",
      ocean: "#2EC4B6",
    },
    status: {
      success: "#228B22",
      warning: "#FF8C00",
      error: "#DC2626",
      info: "#1E4EDF",
      neutral: "#E1E5EA",
    },
    text: {
      primary: "#1A1A1A",
      secondary: "#666666",
      onBrand: "#FFFFFF",
    },
    surface: {
      default: "#FFFFFF",
      muted: "#F5F7FA",
      sunken: "#E9EEF5",
    },
    border: {
      light: "#E1E5EA",
      strong: "#CAD3DD",
    },
  },

  semantic: {
    actionPrimary: "brand.blue",
    actionSecondary: "brand.navy",
    pickupSmart: "brand.ocean",
    statusConfirmed: "status.success",
    statusWaiting: "status.warning",
    statusError: "status.error",
    statusInfo: "status.info",
    statusNeutral: "status.neutral",
  },

  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 10px rgba(0,0,0,0.08)",
    lg: "0 12px 24px rgba(0,0,0,0.10)",
  },

  radius: {
    lg: "20px",
    md: "12px",
    sm: "8px",
    pill: "9999px",
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },

  typography: {
    hero: {
      desktop: "52px",
      mobile: "34px",
      weight: 700,
      lineHeight: 1.1,
    },
    h2: {
      desktop: "30px",
      mobile: "24px",
      weight: 700,
      lineHeight: 1.2,
    },
    h3: {
      desktop: "22px",
      mobile: "20px",
      weight: 600,
      lineHeight: 1.3,
    },
    bodyLg: {
      size: "18px",
      weight: 400,
      lineHeight: 1.6,
    },
    body: {
      size: "16px",
      weight: 400,
      lineHeight: 1.6,
    },
    caption: {
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
    },
    button: {
      size: "16px",
      weight: 600,
      lineHeight: 1.2,
    },
  },

  motion: {
    fast: "150ms",
    base: "200ms",
    slow: "220ms",
    ease: "ease-out",
  },
} as const;
