import { ChannelSyncPayload, EventoChannelSync } from "@/lib/types";

interface ChannelSyncClient {
  publish(evento: EventoChannelSync, payload: ChannelSyncPayload): Promise<void>;
}

async function cargarCliente(): Promise<ChannelSyncClient | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: unknown = await import("@indicium/channel-sync" as string);
    const candidate = mod as { publish?: ChannelSyncClient["publish"] };
    if (typeof candidate.publish === "function") {
      return { publish: candidate.publish.bind(candidate) };
    }
    return null;
  } catch {
    return null;
  }
}

const clientePromise = cargarCliente();

export class ChannelSyncService {
  constructor(
    private readonly clientePromise: Promise<ChannelSyncClient | null> = clientePromise
  ) {}

  async notificar(evento: EventoChannelSync, payload: ChannelSyncPayload): Promise<void> {
    const cliente = await this.clientePromise;

    if (!cliente) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[channel-sync:noop]", evento, payload);
      }
      return;
    }

    try {
      await cliente.publish(evento, payload);
    } catch (err) {
      console.error("[channel-sync:fail]", evento, payload, err);
    }
  }
}

export const channelSyncService = new ChannelSyncService();
