// @ts-check
export const calculateCircleProgress = (value: number) => {
  const radius = 40;
  const c = Math.PI * (radius * 2);

  if (value < 0) value = 0;
  if (value > 100) value = 100;

  return ((100 - value) / 100) * c;
};

export const getProgressAnimation = ({ progress }: { progress: number }) => {
  return `
    @keyframes rankAnimation {
      from {
        stroke-dashoffset: ${calculateCircleProgress(0)};
      }
      to {
        stroke-dashoffset: ${calculateCircleProgress(progress)};
      }
    }
  `;
};

export const getAnimations = () => {
  return `
    /* Animations */
    @keyframes scaleInAnimation {
      from {
        transform: translate(0px, 0px) scale(0);
      }
      to {
        transform: translate(0px, 0px) scale(1);
      }
    }
    @keyframes fadeInAnimation {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
};

export const getStyles = ({
  titleColor,
  textColor,
  iconColor,
  show_icons,
  progress,
}: {
  titleColor?: string;
  textColor?: string;
  iconColor?: string;
  show_icons?: boolean;
  progress?: number;
}) => {
  return `
    .stat {
      font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${textColor};
    }
    @supports(-moz-appearance: auto) {
      /* Selector detects Firefox */
      .stat { font-size:12px; }
    }
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    .cell-text {
      font: 800 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${textColor}; 
      animation: scaleInAnimation 0.3s ease-in-out forwards;
    }
    
    .bold { font-weight: 700 }
    .icon {
      fill: ${iconColor};
      display: ${show_icons ? 'block' : 'none'};
    }
    
    .rank-circle-rim {
      stroke: ${titleColor};
      fill: none;
      stroke-width: 3;
      opacity: 0.2;
    }
    ${
      process.env.NODE_ENV === 'test' || progress === undefined
        ? ''
        : getProgressAnimation({ progress })
    }
  `;
};

// module.exports = { getStyles, getAnimations };
