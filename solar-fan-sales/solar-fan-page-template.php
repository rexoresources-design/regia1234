<?php
/**
 * Template Name: Solar Fan Sales Page
 * Template Post Type: page
 *
 * HOW TO USE IN WORDPRESS:
 * ────────────────────────────────────────────────────────────────────
 * 1. Copy this file into your active WordPress theme folder
 *    e.g. /wp-content/themes/YOUR-THEME/solar-fan-page-template.php
 *
 * 2. In WordPress Admin → Pages → Add New (or edit an existing page)
 *
 * 3. In the right sidebar under "Page Attributes", select:
 *    Template → "Solar Fan Sales Page"
 *
 * 4. Publish/Update the page.
 *
 * 5. View the page — it will render the full standalone sales page,
 *    bypassing your theme's header and footer completely.
 *
 * CUSTOMISATION:
 * ────────────────────────────────────────────────────────────────────
 * - Replace all placeholder phone numbers (2348000000000) with your real WhatsApp number
 * - Replace order.html links with your real WooCommerce/checkout URL
 * - Add your real product images by replacing the SVG fan visual
 * - Update pricing to match your actual selling price
 * - Connect the order form to WooCommerce, Paystack, or Flutterwave
 *
 * WOOCOMMERCE INTEGRATION:
 * - Replace the <a href="order.html"> buttons with:
 *   <a href="<?php echo esc_url( wc_get_checkout_url() ); ?>?add-to-cart=PRODUCT_ID">
 *
 * PAYSTACK / FLUTTERWAVE:
 * - Add the payment SDK script in the <head> section below
 * - Replace the form submit handler in the JavaScript section
 *
 * SEO:
 * - This template uses wp_head() and wp_footer() so Yoast/RankMath SEO
 *   meta tags, Google Analytics, and other head/footer scripts still load
 * ────────────────────────────────────────────────────────────────────
 */

// Disable the theme's default header/footer for a clean full-page layout
remove_action( 'wp_head', '_wp_render_title_tag', 1 );

?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sun King Solar Fan 16" — Stay Cool Without NEPA | Free Delivery Nationwide</title>
<meta name="description" content="Beat Nigeria's heat with the Sun King 16-inch Solar Fan + 20W Panel. Works during power cuts, saves on generator fuel. Order now — free delivery!">
<?php wp_head(); ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body <?php body_class('solar-fan-sales-page'); ?>>
<?php wp_body_open(); ?>

<?php
/*
 * ─────────────────────────────────────────────────────────────────
 * PASTE THE FULL BODY CONTENT FROM index.html HERE
 * (Everything between <body> and </body> tags in index.html)
 *
 * Replace these links:
 *   href="order.html"   → your WooCommerce cart/checkout URL
 *   href="upsell.html"  → your upsell page URL
 *   href="thank-you.html" → your thank you page URL
 *
 * For a WooCommerce direct add-to-cart link, use:
 *   <?php echo esc_url( add_query_arg( 'add-to-cart', get_the_ID(), wc_get_cart_url() ) ); ?>
 * ─────────────────────────────────────────────────────────────────
 *
 * QUICK EMBED OPTION:
 * If you prefer to use Elementor, Divi, Beaver Builder, or any other
 * page builder, simply:
 *   1. Create a new full-width page (no sidebar, no header/footer)
 *   2. Add an "HTML" or "Custom Code" widget/block
 *   3. Paste the FULL content of index.html into that block
 *   4. Save and publish
 *
 * The page is 100% self-contained CSS/JS — no plugin conflicts.
 * ─────────────────────────────────────────────────────────────────
 */
?>

<!-- ═══════════════════════════════════════════════════════════════
     PASTE index.html BODY CONTENT BELOW THIS LINE
═══════════════════════════════════════════════════════════════ -->

<p style="font-family:sans-serif;max-width:700px;margin:60px auto;padding:30px;background:#fff;border:2px dashed #FF6B00;border-radius:12px;color:#333;line-height:1.8;font-size:15px">
  <strong style="color:#FF6B00;font-size:18px">⚠️ WordPress Developer Note</strong><br><br>
  This is the WordPress template wrapper file. To complete setup:<br><br>
  1. Open <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">solar-fan-sales/index.html</code> in a text editor<br>
  2. Copy everything between the <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">&lt;body&gt;</code> and <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">&lt;/body&gt;</code> tags<br>
  3. Paste it directly below the comment block above<br>
  4. Update <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">href="order.html"</code> links to your WooCommerce checkout URL<br>
  5. Done — your WordPress sales page is live!<br><br>
  <strong>Alternative:</strong> Use any page builder (Elementor, Divi, etc.) with a full-width template and paste the complete <code>index.html</code> content into a Custom HTML block.
</p>

<!-- ═══════════════════════════════════════════════════════════════
     PASTE index.html BODY CONTENT ABOVE THIS LINE
═══════════════════════════════════════════════════════════════ -->

<?php wp_footer(); ?>
</body>
</html>
<?php
// End of template
