class ClientNotInitializedError extends Error {
  constructor(message: string) {
    super("Beta9 client has not been initialized, yet: " + message);
    this.name = "ClientNotInitializedError";
  }
}

export { ClientNotInitializedError };
