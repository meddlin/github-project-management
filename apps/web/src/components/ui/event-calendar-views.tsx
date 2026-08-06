import FullCalendar, { type CalendarOptions, type DayCellInfo } from "@fullcalendar/react";
import "@fullcalendar/react/skeleton.css";
import { cn } from "@/lib/utils";

const xxsTextClass = "text-[0.6875rem]/[1.090909]";

const getDayCellBottomClass = (info: DayCellInfo) => cn(!info.isNarrow && "min-h-0.5");

const dayRowClasses: CalendarOptions = {
  rowEventClass: (info) =>
    cn(
      "mb-px border-y",
      info.isStart && "ms-1 rounded-s-sm border-s",
      info.isEnd && "me-1 rounded-e-sm border-e"
    ),
  rowEventInnerClass: (info) => cn("flex items-center", info.isNarrow ? xxsTextClass : "text-xs"),
  rowEventTitleClass: (info) => cn("truncate font-medium", info.isNarrow ? "px-0.5" : "px-1"),
  rowMoreLinkClass: (info) =>
    cn(
      "mb-px rounded-sm border",
      info.isNarrow
        ? "mx-0.5 border-primary hover:bg-accent"
        : "mx-1 self-start border-transparent bg-muted hover:bg-accent"
    ),
  rowMoreLinkInnerClass: (info) => cn(info.isNarrow ? `p-px ${xxsTextClass}` : "p-0.5 text-xs")
};

export type EventCalendarViewProps = CalendarOptions &
  Required<Pick<CalendarOptions, "popoverCloseContent">>;

export function EventCalendarViews({
  height,
  views: userViews,
  ...restOptions
}: EventCalendarViewProps) {
  return (
    <FullCalendar
      backgroundEventClass="bg-accent/30 print:border print:border-border"
      backgroundEventColor="var(--accent)"
      blockEventClass={(info) =>
        cn(
          "group relative border-transparent bg-(--fc-event-color) hover:opacity-90 print:border-border print:bg-background",
          info.isInteractive && "active:opacity-80"
        )
      }
      blockEventInnerClass="text-(--fc-event-contrast-color) print:text-foreground"
      blockEventTitleClass="truncate"
      className={restOptions.className}
      columnMoreLinkClass="my-0.5 rounded-sm border border-transparent bg-muted ring ring-background hover:bg-accent print:border-border print:bg-background"
      columnMoreLinkInnerClass={(info) =>
        cn(info.isNarrow ? `p-0.5 ${xxsTextClass}` : "p-1 text-xs")
      }
      dayCellClass={(info) => cn("border", info.isMajor && "border-foreground/20")}
      dayCellInnerClass={(info) => cn(info.inPopover && "p-2")}
      dayCellTopClass={(info) =>
        cn("flex justify-end", info.isNarrow ? "min-h-0.5" : "min-h-1")
      }
      dayCellTopContent={(info) =>
        !info.isToday ? (
          <>{info.text}</>
        ) : (
          <>
            {info.textParts.map((textPart, index) => (
              <span
                className={cn(
                  "whitespace-pre",
                  textPart.type === "day"
                    ? [
                        "flex items-center justify-center rounded-full bg-primary/20 font-semibold",
                        info.isNarrow ? "size-5" : "size-6 first:-ms-1 last:-me-1",
                        info.hasNavLink &&
                          "outline-ring/50 group-hover:bg-primary/30 group-focus-visible:outline-3"
                      ]
                    : !info.monthText && "text-muted-foreground"
                )}
                key={`${textPart.type}-${index}`}
              >
                {textPart.value}
              </span>
            ))}
          </>
        )
      }
      dayCellTopInnerClass={(info) =>
        cn(
          "flex items-center",
          info.isNarrow ? `my-px h-5 ${xxsTextClass}` : "my-1 h-6 text-sm",
          !info.isToday
            ? [
                "rounded-s-sm whitespace-nowrap",
                !info.isOther && "font-semibold",
                info.isNarrow ? "px-1" : "px-2",
                !info.monthText && "text-muted-foreground",
                info.hasNavLink && "hover:bg-accent"
              ]
            : ["group outline-none", info.isNarrow ? "mx-px" : "mx-2"]
        )
      }
      dayHeaderClass={(info) =>
        cn(
          "justify-center",
          info.inPopover ? "border-b bg-muted" : info.isMajor && "border border-foreground/20"
        )
      }
      dayHeaderInnerClass={(info) =>
        cn(
          "flex items-center",
          info.isNarrow ? "text-xs" : "text-sm",
          info.inPopover
            ? [
                "m-1.5 rounded-sm px-1 py-0.5 font-semibold",
                info.hasNavLink && "hover:bg-accent"
              ]
            : [
                "mx-0.5 my-1.5 rounded-sm px-1.5 py-0.5 text-muted-foreground",
                info.hasNavLink && "hover:bg-accent"
              ]
        )
      }
      dayHeaderRowClass="border"
      dayLaneClass={(info) =>
        cn("border", info.isMajor && "border-foreground/20", info.isDisabled && "bg-muted/50")
      }
      dayLaneInnerClass={(info) => (info.isStack ? "m-1" : info.isNarrow ? "mx-px" : "mx-0.5")}
      dayNarrowWidth={90}
      dayRowClass="border"
      eventClass={(info) =>
        cn(
          "outline-ring/50",
          info.isSelected ? "outline-3" : "focus-visible:outline-3"
        )
      }
      eventColor="var(--primary)"
      eventContrastColor="var(--primary-foreground)"
      eventShortHeight={50}
      fillerClass="border opacity-50"
      height={height}
      highlightClass="bg-primary/10"
      moreLinkClass="outline-ring/50 focus-visible:outline-3"
      moreLinkInnerClass="truncate"
      navLinkClass="outline-ring/50 focus-visible:outline-3"
      nonBusinessHoursClass="bg-muted/50"
      popoverClass="m-1 min-w-55 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
      popoverCloseClass="group absolute end-1.5 top-1.5 rounded-sm p-0.5 outline-ring/50 hover:bg-accent focus-visible:outline-3"
      tableBodyClass="bg-background"
      views={{
        ...userViews,
        dayGrid: {
          ...dayRowClasses,
          dayCellBottomClass: getDayCellBottomClass,
          dayHeaderAlign: (info) => (info.inPopover ? "start" : info.isNarrow ? "center" : "end"),
          dayHeaderDividerClass: "border-b",
          tableHeaderClass: "bg-background",
          ...userViews?.dayGrid
        }
      }}
      {...restOptions}
    />
  );
}
