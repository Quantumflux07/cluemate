export const colors = {
  background: '#090D14',
  panel: '#121824',
  panelBorder: '#1E293B',
  
  // Option specific accents and container backgrounds
  options: {
    a: {
      accent: '#38BDF8', // Light Blue
      text: '#E0F2FE',
      bgIdle: '#0F1A2A',
      bgActive: '#0C2D48',
      borderIdle: '#1E3A5F',
      borderActive: '#38BDF8',
      barFill: 'rgba(56, 189, 248, 0.25)',
    },
    b: {
      accent: '#FB7185', // Soft Pink
      text: '#FFE4E6',
      bgIdle: '#1E1218',
      bgActive: '#3F1224',
      borderIdle: '#4C1D30',
      borderActive: '#FB7185',
      barFill: 'rgba(251, 113, 133, 0.25)',
    },
    c: {
      accent: '#34D399', // Mint Green
      text: '#D1FAE5',
      bgIdle: '#0E1C17',
      bgActive: '#0D3829',
      borderIdle: '#164E3A',
      borderActive: '#34D399',
      barFill: 'rgba(52, 211, 153, 0.25)',
    },
    d: {
      accent: '#FB923C', // Soft Orange
      text: '#FFEDD5',
      bgIdle: '#1E1510',
      bgActive: '#432311',
      borderIdle: '#5A2A14',
      borderActive: '#FB923C',
      barFill: 'rgba(251, 146, 60, 0.25)',
    },
  },

  dontKnow: {
    accent: '#94A3B8',
    text: '#E2E8F0',
    bgIdle: '#131926',
    bgActive: '#1E293B',
    borderIdle: '#242F42',
    borderActive: '#94A3B8',
  },

  commitButton: {
    bg: '#3B82F6',
    bgPressed: '#2563EB',
    text: '#FFFFFF',
    border: '#60A5FA',
  },

  resetButton: {
    text: '#94A3B8',
    textPressed: '#E2E8F0',
  },

  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
  
  status: {
    draft: '#F59E0B',
    committed: '#10B981',
  }
} as const;
