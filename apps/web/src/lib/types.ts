// Forma răspunsurilor API. Decimal-urile din Prisma vin serializate ca string.

export type Role = "ADMIN" | "SALES" | "WAREHOUSE";
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type MovementType = "RECEIPT" | "SALE" | "RETURN" | "ADJUSTMENT";
export type Permission =
  | "products:read"
  | "products:write"
  | "customers:read"
  | "customers:write"
  | "orders:read"
  | "orders:create"
  | "orders:approve"
  | "orders:fulfil"
  | "stock:read"
  | "stock:write"
  | "users:manage";

export interface Me {
  user: { id: number; email: string; name: string; role: Role };
  permissions: Permission[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  unit: string;
  price: string;
  stock: number;
  minStock: number;
  active: boolean;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  _count?: { orders: number };
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  total: string;
  createdAt: string;
  customer: { id: number; name: string };
  createdBy?: { name: string };
  _count?: { items: number };
}

export interface StockMovement {
  id: number;
  type: MovementType;
  quantity: number;
  reason: string | null;
  orderId: number | null;
  createdAt: string;
  user: { name: string };
  product?: { id: number; sku: string; name: string; unit: string };
}

export interface OrderDetail extends OrderSummary {
  notes: string | null;
  customer: Customer;
  createdBy: { id: number; name: string };
  items: {
    id: number;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    product: { id: number; sku: string; name: string; unit: string; stock: number };
  }[];
  movements: StockMovement[];
  allowedTransitions: OrderStatus[];
}

export interface StockAlert {
  id: number;
  stock: number;
  minStock: number;
  createdAt: string;
  product: { id: number; sku: string; name: string; stock: number; minStock: number; unit: string };
}

export interface Dashboard {
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  revenue30d: { total: string; orders: number };
  openAlerts: { count: number; items: StockAlert[] };
  recentOrders: OrderSummary[];
  revenueByDay: { date: string; total: number; orders: number }[];
}
