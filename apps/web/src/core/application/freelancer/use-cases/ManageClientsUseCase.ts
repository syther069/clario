import type { IFreelancerRepository } from "../../../domain/freelancer/ports/IFreelancerRepository";
import type { ClientEntity } from "../../../domain/freelancer/entities/Client";
import type { IEventBus } from "../../ports/IEventBus";

export const EVENT_CLIENTS_UPDATED = "clario:freelancer:clients_updated";

/**
 * Clean Architecture - Application Layer
 * Use Case: ManageClientsUseCase
 * Coordinates fetching, creating, updating, and removing freelancer client records.
 */
export class ManageClientsUseCase {
  public constructor(
    private readonly repository: IFreelancerRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  public async getClients(userId: string): Promise<ClientEntity[]> {
    return this.repository.getClients(userId);
  }

  public async saveClient(client: ClientEntity): Promise<ClientEntity> {
    const saved = await this.repository.saveClient(client);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_CLIENTS_UPDATED, {
        client: saved,
        userId: client.userId,
      });
    }
    return saved;
  }

  public async deleteClient(clientId: string, userId?: string): Promise<void> {
    await this.repository.deleteClient(clientId, userId);
    if (this.eventBus) {
      this.eventBus.publish(EVENT_CLIENTS_UPDATED, {
        deletedClientId: clientId,
        userId,
      });
    }
  }
}
