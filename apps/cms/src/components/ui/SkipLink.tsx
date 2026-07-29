'use client';

type Props = {
  targetId?: string;
  label?: string;
};

/** Link de salto para conteúdo principal (WCAG 2.4.1). */
export function SkipLink({ targetId = 'main-content', label = 'Saltar para o conteúdo' }: Props) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      {label}
    </a>
  );
}
