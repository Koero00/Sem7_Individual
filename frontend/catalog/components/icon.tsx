const paths = {
  bolt: "m13 2-9 12h7l-1 8L21 9h-8l1-7Z",
  bag: "M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  list: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01",
  refresh: "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1",
};

export function Icon({ name, size = 20 }: { name: keyof typeof paths | "search"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "search" ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></> : <path d={paths[name]} />}
  </svg>;
}
