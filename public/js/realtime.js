(function () {
  const handlers = new Map();
  let liveSocket = null;

  const client = {
    get connected() {
      return Boolean(liveSocket && liveSocket.connected);
    },
    get id() {
      return liveSocket ? liveSocket.id : undefined;
    },
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
      if (liveSocket) liveSocket.on(event, handler);
      return client;
    },
    emit(event, ...args) {
      if (liveSocket) {
        liveSocket.emit(event, ...args);
        return client;
      }

      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        callback({ ok: false, message: "Realtime server is reconnecting." });
      }
      return client;
    }
  };

  function attachSocket() {
    if (typeof window.io !== "function") return;
    liveSocket = window.io(window.BACKEND_URL, {
      transports: ["websocket", "polling"],
      timeout: 15000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    handlers.forEach((eventHandlers, event) => {
      eventHandlers.forEach(handler => liveSocket.on(event, handler));
    });
  }

  window.createClassroomSocket = () => client;

  const loader = document.createElement("script");
  loader.src = `${window.BACKEND_URL}/socket.io/socket.io.js`;
  loader.async = true;
  loader.onload = attachSocket;
  loader.onerror = () => {
    window.dispatchEvent(new CustomEvent("classroom-realtime-error"));
  };
  document.head.appendChild(loader);
}());
