import { type CalendarOptions, useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import { EventCalendarCloseIcon } from "@/components/event-calendar-icons";
import { EventCalendarToolbar } from "@/components/event-calendar-toolbar";
import { EventCalendarViews } from "@/components/ui/event-calendar-views";
import { cn } from "@/lib/utils";

const plugins = [dayGridPlugin];

export interface EventCalendarProps
  extends Omit<CalendarOptions, "class" | "className" | "footerToolbar" | "headerToolbar"> {
  className?: string;
}

export function EventCalendar({
  className,
  contentHeight,
  direction,
  height,
  plugins: userPlugins = [],
  ...restOptions
}: EventCalendarProps) {
  const controller = useCalendarController();
  const hasBorderX = !(restOptions.borderlessX ?? restOptions.borderless);
  const hasBorderBottom = !(restOptions.borderlessBottom ?? restOptions.borderless);
  const isHeightAuto = height === "auto" || contentHeight === "auto";

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      dir={direction === "rtl" ? "rtl" : undefined}
      style={{ height }}
    >
      <EventCalendarToolbar
        className={!hasBorderX ? "px-3" : undefined}
        controller={controller}
      />
      <div className="min-h-0 grow">
        <EventCalendarViews
          className={cn(
            "border-t bg-background",
            hasBorderX && "border-x",
            hasBorderBottom && "border-b",
            hasBorderX && !isHeightAuto && "rounded-t-sm",
            hasBorderX && hasBorderBottom && !isHeightAuto && "rounded-b-sm",
            hasBorderX && hasBorderBottom && "shadow-xs",
            !isHeightAuto && "overflow-hidden"
          )}
          controller={controller}
          height={isHeightAuto ? "auto" : height !== undefined ? "100%" : contentHeight}
          initialView="dayGridMonth"
          plugins={[...plugins, ...userPlugins]}
          popoverCloseContent={() => <EventCalendarCloseIcon />}
          {...restOptions}
        />
      </div>
    </div>
  );
}
