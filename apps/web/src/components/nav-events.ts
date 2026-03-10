const navEvents = new EventTarget();

const emitNavRefresh = (): void => {
  navEvents.dispatchEvent(new Event("refresh"));
};

export { navEvents, emitNavRefresh };
