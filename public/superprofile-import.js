/*
 * Reviewlabs: import a product page from Superprofile.
 *
 * Runs on the Reviewlabs import page, in the creator's browser, to read a page
 * they saved from their own superprofile.bio account as .html. We never fetch
 * Superprofile ourselves.
 *
 * Only the fields below are read. Private data on the page (the creator's
 * email, phone, earnings, sales counts, tracking pixels) is never copied.
 */
(function () {
  function str(v, max) {
    return typeof v === "string" ? v.slice(0, max) : "";
  }

  function pick(doc, pageUrl) {
    var el = doc.getElementById("__NEXT_DATA__");
    if (!el) return { error: "not_superprofile" };
    var d;
    try {
      d = JSON.parse(el.textContent).props.pageProps.prefetchedData;
    } catch {
      return { error: "unreadable" };
    }
    if (!d || typeof d.title !== "string") return { error: "not_product" };

    // The price is loaded after the page opens, so it's read from the price bar.
    var price = "";
    var compareAt = "";
    var box = doc.querySelector(".checkout-cta-price__value");
    if (box) {
      var strike = box.querySelector(".lp-price-strikethrough");
      compareAt = strike ? strike.textContent.trim() : "";
      var spans = box.querySelectorAll("span");
      var last = spans.length ? spans[spans.length - 1] : box;
      price = last === strike ? "" : last.textContent.trim();
    }

    var product = (d.products && d.products[0]) || {};
    var refund = product.policies && product.policies.refund;
    var testimonials = d.testimonials && d.testimonials.isEnabled ? d.testimonials.items || [] : [];
    var faqs = d.faqs && d.faqs.isEnabled ? d.faqs.items || [] : [];
    var bump = (d.connectBumpOffers || [])[0];

    return {
      v: 1,
      source: "superprofile",
      url: str(pageUrl, 500),
      title: str(d.title, 500),
      description: str(d.description, 300000),
      cta: str(d.cta, 100),
      currency: str(d.currency, 10),
      cover: (d.cover && d.cover.image && str(d.cover.image.url, 2000)) || "",
      price: str(price, 40),
      compareAt: str(compareAt, 40),
      testimonials: testimonials.slice(0, 50).map(function (t) {
        return { name: str(t.name, 200), comment: str(t.comment, 2000), rating: Number(t.rating) || 5, photo: str(t.photo, 2000) };
      }),
      faqs: faqs.slice(0, 50).map(function (f) {
        return { question: str(f.question, 500), answer: str(f.answer, 5000) };
      }),
      offer: bump
        ? {
            title: str(bump.title, 300),
            description: str(bump.description, 5000),
            cta: str(bump.cta, 100),
            image: (bump.cover && bump.cover.image && str(bump.cover.image.url, 2000)) || "",
            price: Number(bump.price) || 0,
            discountedPrice: bump.hasDiscountedPrice ? Number(bump.discountedPrice) || 0 : 0,
          }
        : null,
      fields: (d.inputFields || [])
        .filter(function (f) { return f && f.isVisible !== false && f.status !== 0; })
        .slice(0, 30)
        .map(function (f) {
          return {
            label: str(f.fieldName, 300),
            type: str(f.fieldType, 40),
            required: !!f.mandatory,
            options: (f.options || []).slice(0, 50).map(function (o) {
              return str(typeof o === "string" ? o : (o && (o.label || o.value || o.text)) || "", 200);
            }),
          };
        }),
      refundPolicy: str((refund && refund.hasPolicy && refund.text) || product.refundPolicy || "", 20000),
      terms: str((d.tandc && d.tandc.isEnabled && d.tandc.text) || "", 20000),
    };
  }

  window.__reviewlabsSuperprofile = { pick: pick };
})();
