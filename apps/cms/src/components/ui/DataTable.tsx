import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes, TableHTMLAttributes } from 'react';

type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
  /** Legenda acessível (visível só para leitores de ecrã se usar sr-only). */
  caption?: string;
  captionClassName?: string;
};

export function DataTableCard({
  children,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={className ?? 'surface-table-card'}>
      <div className="data-table-scroll" tabIndex={0} role="region" aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  );
}

export function DataTable({ className, children, caption, captionClassName, ...rest }: DataTableProps) {
  return (
    <table className={className ?? 'data-table'} {...rest}>
      {caption ? (
        <caption className={captionClassName ?? 'sr-only'}>{caption}</caption>
      ) : null}
      {children}
    </table>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function DataTableHeaderCell({
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th scope="col" {...rest}>
      {children}
    </th>
  );
}

export function DataTableCell({
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return <td {...rest}>{children}</td>;
}

export function DataTableEmptyRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted">
        {message}
      </td>
    </tr>
  );
}
