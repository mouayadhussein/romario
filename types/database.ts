export type OrderType = "delivery" | "pickup" | "dine_in";
export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";
export type OrderingMode = "auto" | "force_open" | "force_closed";
export type ActorRole = "admin" | "staff" | "system" | "customer";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type TimeRange = {
  open: string;
  close: string;
};

export type OpeningHours = Partial<Record<DayKey, TimeRange[]>>;

export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: string | null;
  opening_hours: OpeningHours;
  timezone: string;
  ordering_mode: OrderingMode;
  is_active: boolean;
  sort_order: number;
  /** Present after migration 010; treat missing as 0 in UI. */
  delivery_fee?: number;
  min_order_amount?: number;
  free_delivery_threshold?: number | null;
  created_at?: string;
}

export interface Category {
  id: string;
  branch_id: string;
  name: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface Item {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  branch_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  order_type: OrderType;
  table_number: string | null;
  general_note: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  assigned_to: string | null;
  claimed_at: string | null;
  delivered_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  collected_amount: number | null;
  collected_at: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  tracking_token: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  note: string | null;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  actor_id: string | null;
  actor_role: ActorRole;
  event: string;
  from_status: string | null;
  to_status: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Staff {
  user_id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StaffBranch {
  staff_id: string;
  branch_id: string;
}

export interface CashSettlement {
  id: string;
  staff_id: string;
  amount: number;
  settled_by: string;
  note: string | null;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  branches?: Pick<
    Branch,
    "id" | "name" | "slug" | "whatsapp_number"
  > | null;
  staff?: Pick<Staff, "user_id" | "full_name" | "phone"> | null;
}

export interface CategoryWithItems extends Category {
  items: Item[];
}

export interface BranchWithCategories extends Branch {
  categories: CategoryWithItems[];
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          phone: string | null;
          whatsapp_number: string | null;
          map_url: string | null;
          latitude: number | null;
          longitude: number | null;
          working_hours: string | null;
          opening_hours: OpeningHours;
          timezone: string;
          ordering_mode: OrderingMode;
          is_active: boolean;
          sort_order: number;
          delivery_fee: number;
          min_order_amount: number;
          free_delivery_threshold: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          address?: string | null;
          phone?: string | null;
          whatsapp_number?: string | null;
          map_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          working_hours?: string | null;
          opening_hours?: OpeningHours;
          timezone?: string;
          ordering_mode?: OrderingMode;
          is_active?: boolean;
          sort_order?: number;
          delivery_fee?: number;
          min_order_amount?: number;
          free_delivery_threshold?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          phone?: string | null;
          whatsapp_number?: string | null;
          map_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          working_hours?: string | null;
          opening_hours?: OpeningHours;
          timezone?: string;
          ordering_mode?: OrderingMode;
          is_active?: boolean;
          sort_order?: number;
          delivery_fee?: number;
          min_order_amount?: number;
          free_delivery_threshold?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      branch_counters: {
        Row: {
          branch_id: string;
          last_number: number;
        };
        Insert: {
          branch_id: string;
          last_number?: number;
        };
        Update: {
          branch_id?: string;
          last_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "branch_counters_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: true;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      admins: {
        Row: {
          user_id: string;
        };
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          branch_id: string;
          name: string;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          branch_id: string;
          name: string;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          branch_id?: string;
          name?: string;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          is_available: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          branch_id: string;
          customer_name: string;
          customer_phone: string;
          customer_address: string | null;
          customer_lat: number | null;
          customer_lng: number | null;
          order_type: string;
          table_number: string | null;
          general_note: string | null;
          subtotal: number;
          delivery_fee: number;
          total: number;
          status: string;
          assigned_to: string | null;
          claimed_at: string | null;
          delivered_at: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          collected_amount: number | null;
          collected_at: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          tracking_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          branch_id: string;
          customer_name: string;
          customer_phone: string;
          customer_address?: string | null;
          customer_lat?: number | null;
          customer_lng?: number | null;
          order_type: string;
          table_number?: string | null;
          general_note?: string | null;
          subtotal: number;
          delivery_fee?: number;
          total: number;
          status?: string;
          assigned_to?: string | null;
          claimed_at?: string | null;
          delivered_at?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          collected_amount?: number | null;
          collected_at?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          tracking_token?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          branch_id?: string;
          customer_name?: string;
          customer_phone?: string;
          customer_address?: string | null;
          customer_lat?: number | null;
          customer_lng?: number | null;
          order_type?: string;
          table_number?: string | null;
          general_note?: string | null;
          subtotal?: number;
          delivery_fee?: number;
          total?: number;
          status?: string;
          assigned_to?: string | null;
          claimed_at?: string | null;
          delivered_at?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          collected_amount?: number | null;
          collected_at?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          tracking_token?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          user_id: string;
          full_name: string;
          phone: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_branches: {
        Row: {
          staff_id: string;
          branch_id: string;
        };
        Insert: {
          staff_id: string;
          branch_id: string;
        };
        Update: {
          staff_id?: string;
          branch_id?: string;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          actor_id: string | null;
          actor_role: string;
          event: string;
          from_status: string | null;
          to_status: string | null;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          actor_id?: string | null;
          actor_role: string;
          event: string;
          from_status?: string | null;
          to_status?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          actor_id?: string | null;
          actor_role?: string;
          event?: string;
          from_status?: string | null;
          to_status?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      cash_settlements: {
        Row: {
          id: string;
          staff_id: string;
          amount: number;
          settled_by: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          amount: number;
          settled_by: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          amount?: number;
          settled_by?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          item_id: string | null;
          name_snapshot: string;
          price_snapshot: number;
          quantity: number;
          note: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          item_id?: string | null;
          name_snapshot: string;
          price_snapshot: number;
          quantity: number;
          note?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          item_id?: string | null;
          name_snapshot?: string;
          price_snapshot?: number;
          quantity?: number;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_order_number: {
        Args: { p_branch_id: string };
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      staff_branch_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      claim_order: {
        Args: { p_order_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      deliver_order: {
        Args: {
          p_order_id: string;
          p_collected_amount?: number | null;
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      release_order: {
        Args: { p_order_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type { Json };
