export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string;
          country: string;
          created_at: string;
          full_name: string;
          id: string;
          is_default: boolean;
          landmark: string | null;
          line1: string;
          line2: string | null;
          phone: string;
          pincode: string;
          state: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city: string;
          country?: string;
          created_at?: string;
          full_name: string;
          id?: string;
          is_default?: boolean;
          landmark?: string | null;
          line1: string;
          line2?: string | null;
          phone: string;
          pincode: string;
          state: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string;
          country?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_default?: boolean;
          landmark?: string | null;
          line1?: string;
          line2?: string | null;
          phone?: string;
          pincode?: string;
          state?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          quantity: number;
          user_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          quantity?: number;
          user_id: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          user_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          is_read: boolean;
          message: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          is_read?: boolean;
          message: string;
          name: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          name?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          discount_type: string;
          discount_value: number;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          max_uses: number | null;
          maximum_discount: number | null;
          min_order_total: number | null;
          per_user_limit: number | null;
          starts_at: string | null;
          updated_at: string;
          used_count: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          discount_type: string;
          discount_value: number;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          max_uses?: number | null;
          maximum_discount?: number | null;
          min_order_total?: number | null;
          per_user_limit?: number | null;
          starts_at?: string | null;
          updated_at?: string;
          used_count?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          max_uses?: number | null;
          maximum_discount?: number | null;
          min_order_total?: number | null;
          per_user_limit?: number | null;
          starts_at?: string | null;
          updated_at?: string;
          used_count?: number;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          mrp: number | null;
          order_id: string;
          price: number;
          product_id: string | null;
          product_image: string | null;
          product_name: string;
          quantity: number;
          sku: string | null;
          total: number;
          unit_price: number | null;
          variant_id: string | null;
          variant_label: string | null;
        };
        Insert: {
          id?: string;
          mrp?: number | null;
          order_id: string;
          price?: number;
          product_id?: string | null;
          product_image?: string | null;
          product_name: string;
          quantity: number;
          sku?: string | null;
          total?: number;
          unit_price?: number | null;
          variant_id?: string | null;
          variant_label?: string | null;
        };
        Update: {
          id?: string;
          mrp?: number | null;
          order_id?: string;
          price?: number;
          product_id?: string | null;
          product_image?: string | null;
          product_name?: string;
          quantity?: number;
          sku?: string | null;
          total?: number;
          unit_price?: number | null;
          variant_id?: string | null;
          variant_label?: string | null;
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
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_notifications: {
        Row: {
          created_at: string;
          error: string | null;
          event: string;
          id: string;
          order_id: string;
          provider: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          event: string;
          id?: string;
          order_id: string;
          provider?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          event?: string;
          id?: string;
          order_id?: string;
          provider?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          id: string;
          new_fulfillment: string | null;
          new_status: string | null;
          note: string | null;
          order_id: string;
          previous_fulfillment: string | null;
          previous_status: string | null;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_fulfillment?: string | null;
          new_status?: string | null;
          note?: string | null;
          order_id: string;
          previous_fulfillment?: string | null;
          previous_status?: string | null;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_fulfillment?: string | null;
          new_status?: string | null;
          note?: string | null;
          order_id?: string;
          previous_fulfillment?: string | null;
          previous_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          coupon_code: string | null;
          created_at: string;
          currency: string;
          customer_email: string | null;
          delivered_at: string | null;
          discount_amount: number;
          expected_delivery_date: string | null;
          forwarded_at: string | null;
          forwarding_failure_reason: string | null;
          forwarding_status: string;
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"];
          id: string;
          notes: string | null;
          order_number: string | null;
          payment_method: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          shipped_at: string | null;
          shipping: number;
          shipping_address: Json;
          shipping_address_snapshot: Json | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          supplier_id: string | null;
          supplier_order_id: string | null;
          total: number;
          tracking_carrier: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          coupon_code?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          delivered_at?: string | null;
          discount_amount?: number;
          expected_delivery_date?: string | null;
          forwarded_at?: string | null;
          forwarding_failure_reason?: string | null;
          forwarding_status?: string;
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
          id?: string;
          notes?: string | null;
          order_number?: string | null;
          payment_method?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          shipped_at?: string | null;
          shipping?: number;
          shipping_address: Json;
          shipping_address_snapshot?: Json | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          supplier_id?: string | null;
          supplier_order_id?: string | null;
          total: number;
          tracking_carrier?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          coupon_code?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          delivered_at?: string | null;
          discount_amount?: number;
          expected_delivery_date?: string | null;
          forwarded_at?: string | null;
          forwarding_failure_reason?: string | null;
          forwarding_status?: string;
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
          id?: string;
          notes?: string | null;
          order_number?: string | null;
          payment_method?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          shipped_at?: string | null;
          shipping?: number;
          shipping_address?: Json;
          shipping_address_snapshot?: Json | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          supplier_id?: string | null;
          supplier_order_id?: string | null;
          total?: number;
          tracking_carrier?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          metadata: Json | null;
          method: string | null;
          order_id: string;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_order_id: string | null;
          provider_payment_id: string | null;
          provider_signature: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json | null;
          method?: string | null;
          order_id: string;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          provider_signature?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json | null;
          method?: string | null;
          order_id?: string;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          provider_signature?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          id: string;
          image_url: string;
          is_primary: boolean;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          image_url: string;
          is_primary?: boolean;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string;
          is_primary?: boolean;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          is_visible: boolean;
          product_id: string;
          rating: number;
          title: string | null;
          updated_at: string;
          user_id: string;
          verified_purchase: boolean;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          product_id: string;
          rating: number;
          title?: string | null;
          updated_at?: string;
          user_id: string;
          verified_purchase?: boolean;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          product_id?: string;
          rating?: number;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          verified_purchase?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          attributes: Json | null;
          cost_price: number | null;
          created_at: string;
          currency: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          mrp: number | null;
          option1_name: string | null;
          option1_value: string | null;
          option2_name: string | null;
          option2_value: string | null;
          option3_name: string | null;
          option3_value: string | null;
          price: number | null;
          product_id: string;
          sku: string | null;
          stock: number;
          supplier_sku: string | null;
          updated_at: string;
        };
        Insert: {
          attributes?: Json | null;
          cost_price?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          mrp?: number | null;
          option1_name?: string | null;
          option1_value?: string | null;
          option2_name?: string | null;
          option2_value?: string | null;
          option3_name?: string | null;
          option3_value?: string | null;
          price?: number | null;
          product_id: string;
          sku?: string | null;
          stock?: number;
          supplier_sku?: string | null;
          updated_at?: string;
        };
        Update: {
          attributes?: Json | null;
          cost_price?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          mrp?: number | null;
          option1_name?: string | null;
          option1_value?: string | null;
          option2_name?: string | null;
          option2_value?: string | null;
          option3_name?: string | null;
          option3_value?: string | null;
          price?: number | null;
          product_id?: string;
          sku?: string | null;
          stock?: number;
          supplier_sku?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          badge: string | null;
          category_id: string | null;
          cost_price: number | null;
          created_at: string;
          currency: string;
          description: string | null;
          dimensions: Json | null;
          id: string;
          image_url: string | null;
          images: Json;
          is_active: boolean;
          is_bestseller: boolean;
          is_featured: boolean;
          mrp: number | null;
          name: string;
          price: number;
          rating: number;
          review_count: number;
          shipping_days_max: number | null;
          shipping_days_min: number | null;
          short_description: string | null;
          sku: string | null;
          slug: string;
          specs: Json;
          stock: number;
          supplier_id: string | null;
          supplier_sku: string | null;
          supplier_url: string | null;
          updated_at: string;
          weight_grams: number | null;
        };
        Insert: {
          badge?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          dimensions?: Json | null;
          id?: string;
          image_url?: string | null;
          images?: Json;
          is_active?: boolean;
          is_bestseller?: boolean;
          is_featured?: boolean;
          mrp?: number | null;
          name: string;
          price: number;
          rating?: number;
          review_count?: number;
          shipping_days_max?: number | null;
          shipping_days_min?: number | null;
          short_description?: string | null;
          sku?: string | null;
          slug: string;
          specs?: Json;
          stock?: number;
          supplier_id?: string | null;
          supplier_sku?: string | null;
          supplier_url?: string | null;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Update: {
          badge?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          dimensions?: Json | null;
          id?: string;
          image_url?: string | null;
          images?: Json;
          is_active?: boolean;
          is_bestseller?: boolean;
          is_featured?: boolean;
          mrp?: number | null;
          name?: string;
          price?: number;
          rating?: number;
          review_count?: number;
          shipping_days_max?: number | null;
          shipping_days_min?: number | null;
          short_description?: string | null;
          sku?: string | null;
          slug?: string;
          specs?: Json;
          stock?: number;
          supplier_id?: string | null;
          supplier_sku?: string | null;
          supplier_url?: string | null;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_config: {
        Row: {
          base_shipping_charge: number;
          cod_min_order_value: number | null;
          created_at: string;
          free_shipping_threshold: number;
          id: string;
          is_active: boolean;
          pincode_restrictions: Json;
          updated_at: string;
        };
        Insert: {
          base_shipping_charge?: number;
          cod_min_order_value?: number | null;
          created_at?: string;
          free_shipping_threshold?: number;
          id?: string;
          is_active?: boolean;
          pincode_restrictions?: Json;
          updated_at?: string;
        };
        Update: {
          base_shipping_charge?: number;
          cod_min_order_value?: number | null;
          created_at?: string;
          free_shipping_threshold?: number;
          id?: string;
          is_active?: boolean;
          pincode_restrictions?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          api_key_ref: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          platform: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          api_key_ref?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          platform?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          api_key_ref?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          platform?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          user_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          user_id: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          user_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      calculate_shipping: {
        Args: { p_subtotal: number };
        Returns: number;
      };
      create_order_with_stock_check: {
        Args: {
          p_customer_email?: string | null;
          p_coupon_code?: string | null;
          p_items: Json;
          p_payment_method?: string;
          p_shipping_address: Json;
          p_user_id: string;
        };
        Returns: string;
      };
      decrement_product_stock: {
        Args: { p_product_id: string; p_quantity: number };
        Returns: boolean;
      };
      decrement_variant_stock: {
        Args: { p_quantity: number; p_variant_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      lookup_order:
        | {
            Args: { _email: string; _order_id: string };
            Returns: {
              created_at: string;
              customer_email: string | null;
              delivered_at: string | null;
              expected_delivery_date: string | null;
              forwarding_status: string;
              fulfillment_status: string;
              id: string;
              order_number: string | null;
              payment_method: string;
              payment_status: string;
              shipped_at: string | null;
              status: string;
              total: number;
              tracking_carrier: string | null;
              tracking_number: string | null;
              tracking_url: string | null;
            }[];
          }
        | {
            Args: { _email: string; _order_number: string };
            Returns: {
              created_at: string;
              customer_email: string | null;
              delivered_at: string | null;
              expected_delivery_date: string | null;
              forwarding_status: string;
              fulfillment_status: string;
              id: string;
              order_number: string | null;
              payment_method: string;
              payment_status: string;
              shipped_at: string | null;
              status: string;
              total: number;
              tracking_carrier: string | null;
              tracking_number: string | null;
              tracking_url: string | null;
            }[];
          };
      validate_cart: {
        Args: { p_user_id: string };
        Returns: {
          available_stock: number;
          error_message: string | null;
          image_url: string | null;
          is_valid: boolean;
          mrp: number | null;
          name: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          variant_id: string | null;
        }[];
      };
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number; p_user_id?: string | null };
        Returns: {
          coupon_code: string | null;
          coupon_id: string | null;
          discount: number;
          error: string | null;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "customer";
      fulfillment_status:
        | "pending"
        | "processing"
        | "packed"
        | "shipped"
        | "out_for_delivery"
        | "delivered"
        | "returned"
        | "cancelled";
      order_status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
      payment_provider: "razorpay" | "cod" | "manual";
      payment_status:
        "pending" | "authorized" | "captured" | "failed" | "refunded" | "cancelled" | "paid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "customer"],
      fulfillment_status: [
        "pending",
        "processing",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "returned",
        "cancelled",
      ],
      order_status: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      payment_provider: ["razorpay", "cod", "manual"],
      payment_status: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "cancelled",
        "paid",
      ],
    },
  },
} as const;
