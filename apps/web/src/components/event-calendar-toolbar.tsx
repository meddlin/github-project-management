import type { CalendarController } from "@fullcalendar/react";
import { EventCalendarNextIcon, EventCalendarPrevIcon } from "@/components/event-calendar-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EventCalendarToolbarProps {
  className?: string;
  controller: CalendarController;
}

export function EventCalendarToolbar({ className, controller }: EventCalendarToolbarProps) {
  const buttons = controller.getButtonState();

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label={buttons.today.hint}
          onClick={() => controller.today()}
          variant="outline"
        >
          {buttons.today.text}
        </Button>
        <Button
          aria-label={buttons.prev.hint}
          disabled={buttons.prev.isDisabled}
          onClick={() => controller.prev()}
          size="icon"
          variant="ghost"
        >
          <EventCalendarPrevIcon />
        </Button>
        <Button
          aria-label={buttons.next.hint}
          disabled={buttons.next.isDisabled}
          onClick={() => controller.next()}
          size="icon"
          variant="ghost"
        >
          <EventCalendarNextIcon />
        </Button>
      </div>
      <h2 className="text-xl font-medium text-foreground">{controller.view?.title}</h2>
    </div>
  );
}
