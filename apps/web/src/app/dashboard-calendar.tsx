"use client";

import type { EventClickInfo, EventDisplayInfo, EventInput, MountInfo } from "@fullcalendar/react";
import { useMemo } from "react";
import { EventCalendar } from "@/components/event-calendar";
import type { DashboardCalendarItem } from "./dashboard-data";

function addUtcDay(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}

function buildEvent(item: DashboardCalendarItem): EventInput {
  const isClosed = item.state.toUpperCase() === "CLOSED";

  return {
    allDay: true,
    color: isClosed ? "var(--muted)" : "var(--primary)",
    contrastColor: isClosed ? "var(--muted-foreground)" : "var(--primary-foreground)",
    end: addUtcDay(item.endDate),
    extendedProps: {
      state: item.state
    },
    id: item.id,
    start: item.startDate,
    title: `${item.repositoryFullName} #${item.number} · ${item.title}`,
    url: item.url
  };
}

function openIssue(eventInfo: EventClickInfo) {
  eventInfo.jsEvent.preventDefault();

  if (eventInfo.event.url) {
    window.open(eventInfo.event.url, "_blank", "noopener,noreferrer");
  }
}

function labelIssue({ el, event }: MountInfo<EventDisplayInfo>) {
  const state = String(event.extendedProps.state ?? "").toLowerCase();
  const stateLabel = state ? `, ${state}` : "";

  el.setAttribute("aria-label", `${event.title}${stateLabel}`);
  el.setAttribute("title", `${event.title}${stateLabel}`);
}

export function DashboardCalendar({ items }: { items: DashboardCalendarItem[] }) {
  const events = useMemo(() => items.map(buildEvent), [items]);

  return (
    <section aria-label="Issue calendar" className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No issues in your favorite repositories have both a start and end date yet.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Showing {items.length} dated issue{items.length === 1 ? "" : "s"} across your favorite
          repositories.
        </p>
      )}
      <EventCalendar
        contentHeight="auto"
        dayMaxEvents={3}
        displayEventTime={false}
        eventClick={openIssue}
        eventDidMount={labelIssue}
        eventDisplay="block"
        eventOrder="start,end,title"
        eventOrderStrict
        eventSlicing
        events={events}
        fixedWeekCount
        timeZone="UTC"
      />
    </section>
  );
}
