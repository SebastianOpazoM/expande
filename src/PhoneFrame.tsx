import type { ReactNode } from 'react';

type PhoneStageProps = {
  children: ReactNode;
  caption?: string;
};

export function PhoneStage({ children, caption = 'Prototipo móvil' }: PhoneStageProps) {
  return (
    <div className="desktop-stage">
      <div className="desktop-caption">
        <span>{caption}</span>
      </div>
      <div className="device-frame">
        <span className="device-button device-button-silent" aria-hidden="true" />
        <span className="device-button device-button-volume-up" aria-hidden="true" />
        <span className="device-button device-button-volume-down" aria-hidden="true" />
        <span className="device-button device-button-power" aria-hidden="true" />
        <div className="device-shell">
          <span className="device-speaker" aria-hidden="true" />
          {children}
          <span className="device-home-indicator" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
