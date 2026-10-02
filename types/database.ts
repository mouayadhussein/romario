export type OrderType = "delivery" | "pickup" | "dine_in";
export type OrderStatus = "new" | "preparing" | "delivered" | "cancelled";
export type OrderingMode = "auto" | "force_open" | "force_closed";

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
  total: number;
  status: OrderStatus;
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

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  branches?: Pick<Branch, "id" | "name" | "slug" | "whatsapp_number"> | null;
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
          total: number;
          status: string;
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
          total: number;
          status?: string;
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
          total?: number;
          status?: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type { Json };
