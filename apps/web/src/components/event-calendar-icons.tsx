import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";

export function EventCalendarPrevIcon() {
  return <ChevronLeftIcon className="[[dir=rtl]_&]:rotate-180" />;
}

export function EventCalendarNextIcon() {
  return <ChevronRightIcon className="[[dir=rtl]_&]:rotate-180" />;
}

export function EventCalendarCloseIcon() {
  return <XIcon className="size-5 text-muted-foreground group-hover:text-foreground" />;
}
