import type { ComponentChildren } from "preact";

export function ExternalLink({
  href,
  class: className,
  children
}: {
  href: string;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <a class={className} href={href} target="_blank" rel="noopener noreferrer">
      {children} <span aria-hidden="true">↗</span>
      <span class="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
