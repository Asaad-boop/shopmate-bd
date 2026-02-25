
-- RPC: supplier_payables_aging - returns supplier-level aging with buckets
CREATE OR REPLACE FUNCTION public.supplier_payables_aging()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'total_outstanding', COALESCE((
      SELECT sum(gr.total_product_cost - COALESCE(paid.total_paid, 0))
      FROM goods_receipts gr
      LEFT JOIN (
        SELECT spa.payable_id, sum(spa.allocated_amount) as total_paid
        FROM supplier_payment_allocations spa
        JOIN supplier_payments sp ON sp.id = spa.payment_id AND sp.status = 'posted'
        GROUP BY spa.payable_id
      ) paid ON paid.payable_id = gr.id
      WHERE gr.status = 'posted'
        AND (gr.total_product_cost - COALESCE(paid.total_paid, 0)) > 0.01
    ), 0),

    'suppliers', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM (
        SELECT
          sup.id as supplier_id,
          sup.name as supplier_name,
          count(gr.id)::int as open_grns,
          sum(gr.total_product_cost)::numeric as total_invoiced,
          sum(COALESCE(paid.total_paid, 0))::numeric as total_paid,
          sum(gr.total_product_cost - COALESCE(paid.total_paid, 0))::numeric as outstanding,
          -- Aging buckets
          sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) <= 15 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END)::numeric as bucket_0_15,
          sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) > 15 AND extract(day FROM now() - gr.receipt_date::timestamp) <= 30 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END)::numeric as bucket_16_30,
          sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) > 30 AND extract(day FROM now() - gr.receipt_date::timestamp) <= 60 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END)::numeric as bucket_31_60,
          sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) > 60 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END)::numeric as bucket_60_plus
        FROM goods_receipts gr
        JOIN suppliers sup ON sup.id = gr.supplier_id
        LEFT JOIN (
          SELECT spa.payable_id, sum(spa.allocated_amount) as total_paid
          FROM supplier_payment_allocations spa
          JOIN supplier_payments sp ON sp.id = spa.payment_id AND sp.status = 'posted'
          GROUP BY spa.payable_id
        ) paid ON paid.payable_id = gr.id
        WHERE gr.status = 'posted'
          AND (gr.total_product_cost - COALESCE(paid.total_paid, 0)) > 0.01
        GROUP BY sup.id, sup.name
        ORDER BY outstanding DESC
      ) s
    ), '[]'::json),

    'buckets', (
      SELECT row_to_json(b) FROM (
        SELECT
          COALESCE(sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) <= 15 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END), 0)::numeric as "0-15",
          COALESCE(sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) > 15 AND extract(day FROM now() - gr.receipt_date::timestamp) <= 30 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END), 0)::numeric as "16-30",
          COALESCE(sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) > 30 AND extract(day FROM now() - gr.receipt_date::timestamp) <= 60 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END), 0)::numeric as "31-60",
          COALESCE(sum(CASE WHEN extract(day FROM now() - gr.receipt_date::timestamp) > 60 THEN gr.total_product_cost - COALESCE(paid.total_paid, 0) ELSE 0 END), 0)::numeric as "60+"
        FROM goods_receipts gr
        LEFT JOIN (
          SELECT spa.payable_id, sum(spa.allocated_amount) as total_paid
          FROM supplier_payment_allocations spa
          JOIN supplier_payments sp ON sp.id = spa.payment_id AND sp.status = 'posted'
          GROUP BY spa.payable_id
        ) paid ON paid.payable_id = gr.id
        WHERE gr.status = 'posted'
          AND (gr.total_product_cost - COALESCE(paid.total_paid, 0)) > 0.01
      ) b
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- RPC: supplier_payable_detail - returns GRNs + payments for a single supplier
CREATE OR REPLACE FUNCTION public.supplier_payable_detail(p_supplier_id uuid)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'grns', COALESCE((
      SELECT json_agg(row_to_json(g))
      FROM (
        SELECT
          gr.id, gr.grn_number, gr.receipt_date, gr.total_product_cost,
          gr.po_id, po.po_number,
          COALESCE(paid.total_paid, 0)::numeric as paid,
          (gr.total_product_cost - COALESCE(paid.total_paid, 0))::numeric as outstanding,
          extract(day FROM now() - gr.receipt_date::timestamp)::int as days_since
        FROM goods_receipts gr
        LEFT JOIN purchase_orders po ON po.id = gr.po_id
        LEFT JOIN (
          SELECT spa.payable_id, sum(spa.allocated_amount) as total_paid
          FROM supplier_payment_allocations spa
          JOIN supplier_payments sp ON sp.id = spa.payment_id AND sp.status = 'posted'
          GROUP BY spa.payable_id
        ) paid ON paid.payable_id = gr.id
        WHERE gr.supplier_id = p_supplier_id AND gr.status = 'posted'
        ORDER BY gr.receipt_date DESC
      ) g
    ), '[]'::json),

    'payments', COALESCE((
      SELECT json_agg(row_to_json(p))
      FROM (
        SELECT
          sp.id, sp.payment_number, sp.payment_date, sp.amount,
          sp.payment_method, sp.reference, sp.notes, sp.status,
          coa.name as paid_from_name, coa.code as paid_from_code
        FROM supplier_payments sp
        LEFT JOIN chart_of_accounts coa ON coa.id = sp.paid_from_account_id
        WHERE sp.supplier_id = p_supplier_id
        ORDER BY sp.payment_date DESC
        LIMIT 50
      ) p
    ), '[]'::json)
  ) INTO result;
  RETURN result;
END;
$function$;
