import React from "react";

export const theme = {
  colors: {
    primary: "#00B1F2", // Sky Blue
    primaryHover: "#0091c7", // Darker Sky Blue
    secondary: "#64748b", // Slate 500
    background: "#f8fafc", // Slate 50
    surface: "#ffffff",
    text: "#0f172a", // Slate 900
    textSecondary: "#475569", // Slate 600
    border: "#e2e8f0", // Slate 200
    danger: "#ef4444", // Red 500
    dangerHover: "#dc2626", // Red 600
    success: "#22c55e", // Green 500
    warning: "#f59e0b", // Amber 500
    inputBg: "#ffffff",
  },
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
};

export const GlobalStyles = ({ extraCss = "" }: { extraCss?: string }) => (
  <style>
    {`
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: ${theme.colors.background};
        color: ${theme.colors.text};
        -webkit-font-smoothing: antialiased;
        ${extraCss}
      }
      
      * {
        box-sizing: border-box;
      }

      /* Custom Scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }

      /* Transitions */
      .transition-all {
        transition: all 0.2s ease-in-out;
      }

      /* Input Focus */
      .input-focus:focus {
        outline: none;
        border-color: ${theme.colors.primary};
        box-shadow: 0 0 0 3px rgba(0, 177, 242, 0.1);
      }

      /* Button Hover */
      .btn-primary:hover {
        background-color: ${theme.colors.primaryHover} !important;
        transform: translateY(-1px);
      }
      .btn-primary:active {
        transform: translateY(0);
      }
      
      .btn-danger:hover {
        color: ${theme.colors.dangerHover} !important;
        background-color: #fee2e2 !important;
      }

      /* Utility Classes */
      .hover-bg:hover {
        background-color: #f1f5f9 !important;
      }
      
      .btn-icon:hover {
        color: ${theme.colors.primary} !important;
        background-color: #e0f2fe !important;
      }

      /* Table Styles */
      .usage-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .usage-table th {
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid ${theme.colors.border};
        color: ${theme.colors.textSecondary};
        font-weight: 600;
        font-size: 0.875rem;
      }
      .usage-table td {
        padding: 12px 16px;
        border-bottom: 1px solid ${theme.colors.border};
        font-size: 0.875rem;
        color: ${theme.colors.text};
      }
      .usage-table tr:last-child td {
        border-bottom: none;
      }
      .usage-table tr:hover td {
        background-color: #f1f5f9;
      }
    `}
  </style>
);
