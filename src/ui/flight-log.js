import { byId } from './dom.js';

/** Clickable list of every event; highlights the latest milestone and scrolls only itself. */
export function createFlightLog({ model, player }) {
  const list = byId('flightLog');
  const rows = model.mission.events.map((event) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `log__item${event.cancelled ? ' is-cancelled' : ''}`;
    button.title = event.desc;
    const title = document.createElement('span');
    title.className = 'log__title';
    title.textContent = event.cancelled ? `${event.title} (cancelled)` : event.title;
    const time = document.createElement('span');
    time.className = 'log__time';
    time.textContent = `T+${event.label}`;
    button.append(title, time);
    button.addEventListener('click', () => player.seek(event.met));
    item.appendChild(button);
    list.appendChild(item);
    return { event, button };
  });

  let active = null;

  function scrollIntoList(el) {
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top, behavior: 'smooth' });
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight, behavior: 'smooth' });
  }

  return {
    render(t, milestone) {
      for (const row of rows) row.button.classList.toggle('is-past', row.event.met <= t);
      const next = rows.find((row) => row.event === milestone) ?? null;
      if (next === active) return;
      active?.button.classList.remove('is-active');
      if (next) {
        next.button.classList.add('is-active');
        scrollIntoList(next.button.parentElement);
      }
      active = next;
    },
  };
}
