/* =====================================================================
   MEDIA PORTAL CONTENT
   Edit this file to change what each year group sees. Nothing else
   on the site needs to change.

   Each year has:
     page:        a link to the class web page (or "" for none)
     assignments: a list of cards
     resources:   a list of cards

   A card looks like this (copy, paste, then change the words):
     { title: "Short film task",
       text:  "Due Week 6",
       url:   "https://...",            // or a file on this site, e.g. "/film-trailers.html"
       image: "/images/my-picture.jpg"  // optional, upload pictures to public/images
     },

   Rules: keep the quote marks "like this", keep a comma after each },
   and don't delete the square brackets [ ].
   ===================================================================== */
window.PORTAL = {
  years: {
   "8": {
page: "",
assignments: [
{ title: "Photography Unit",
text: "Learn one photography idea at a time: shots, composition, aperture, shutter speed, ISO and more.",
url: "/photography-unit.html",
image: "" },
{ title: "My Photography Folio",
text: "Drag and drop your best photos, add your labels, then save it as a PDF to hand in.",
url: "/photography-folio.html",
image: "" }
],
resources: []
},
    "9": {
      page: "",
      assignments: [],
      resources: []
    },
    "10": {
      page: "",
      assignments: [],
      resources: []
    },
    "11": {
      page: "",
      assignments: [
        { title: "Film Trailers: Genre and Structure",
          text:  "Task 2 · Genre, trailer structure and your production task. Work through all three parts with your group.",
          url:   "/film-trailers.html",
          image: "" }
      ],
      resources: []
    },
    "12": {
      page: "",
      assignments: [],
      resources: []
    }
  }
};
