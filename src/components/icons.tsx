import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function HomeIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3Z" /></svg>;
}
export function SearchIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}
export function SparkIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m12 2 1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4Z" /><path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7Z" /></svg>;
}
export function BookmarkIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 3h12v18l-6-4-6 4Z" /></svg>;
}
export function UserIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}
export function ChevronIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m9 18 6-6-6-6" /></svg>;
}
