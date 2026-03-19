export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    primary: '#000000',
    secondary: '#666666',
    tertiary: '#999999',
    border: '#E0E0E0',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    success: '#333333',
    warning: '#666666',
    error: '#000000',
  },
  dark: {
    background: '#000000',
    surface: '#1A1A1A',
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    tertiary: '#707070',
    border: '#333333',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textTertiary: '#707070',
    success: '#CCCCCC',
    warning: '#B0B0B0',
    error: '#FFFFFF',
  },
};

export const getColors = (darkMode: boolean) => {
  return darkMode ? colors.dark : colors.light;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
