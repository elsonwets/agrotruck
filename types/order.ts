export interface Order {
  id: string;
  requestedTruckCount: number;
  truckType: string;
  pickupLocation: string;
  dropoffLocation: string;
  neededFrom: string;
  cargoDescription: string;
  clientName: string;
  clientPhone: string;
  createdAt: string;
}
