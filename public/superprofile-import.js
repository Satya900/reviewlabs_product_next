/*
 * Reviewlabs: import a product page from Superprofile.
 *
 * Runs in two places:
 * 1. As a bookmarklet on the creator's own superprofile.bio page. Their browser
 *    has already loaded the page, so we read it there and hand it to the
 *    Reviewlabs tab with postMessage. We never fetch Superprofile ourselves.
 * 2. On the Reviewlabs import page, to read a page the creator saved as .html.
 *
 * Only the fields below are read. Private data on the page (the creator's
 * email, phone, earnings, sales counts, tracking pixels) is never copied.
 */
(function () {
  var self = document.currentScript;
  var APP = self ? new URL(self.src).origin : "https://reviewlabs.space";

  function str(v, max) {
    return typeof v === "string" ? v.slice(0, max) : "";
  }

  function pick(doc, pageUrl) {
    var el = doc.getElementById("__NEXT_DATA__");
    if (!el) return { error: "not_superprofile" };
    var d;
    try {
      d = JSON.parse(el.textContent).props.pageProps.prefetchedData;
    } catch (e) {
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

  if (!self || self.getAttribute("data-mode") !== "bookmarklet") return;

  // Bookmarklet: the loader already opened the Reviewlabs tab (window.__rlWin)
  // inside the click, so popup blockers allow it.
  var target = window.__rlWin;
  if (!/(^|\.)superprofile\.bio$/.test(location.hostname)) {
    if (target) target.close();
    alert("Open your product page on superprofile.bio first, then click \"Import to Reviewlabs\".");
    return;
  }
  var data = pick(document, location.href.split("?")[0].split("#")[0]);
  if (data.error) {
    if (target) target.close();
    alert("This doesn't look like a Superprofile product page. Open the product page itself (superprofile.bio/vp/...) and try again.");
    return;
  }
  if (!target || target.closed) {
    alert("Your browser blocked the Reviewlabs tab. Allow pop-ups for superprofile.bio and click Import again.");
    return;
  }

  // The Reviewlabs tab says "ready" (again after a login redirect); answer with the data.
  var sent = 0;
  window.addEventListener("message", function (event) {
    if (event.origin !== APP || event.source !== target) return;
    if (!event.data || event.data.type !== "reviewlabs-import-ready") return;
    target.postMessage({ type: "reviewlabs-import-data", payload: data }, APP);
    sent++;
  });
  setTimeout(function () {
    if (!sent) console.warn("Reviewlabs import: the Reviewlabs tab never asked for the data.");
  }, 600000);
})();
