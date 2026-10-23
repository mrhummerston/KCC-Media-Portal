/* =====================================================================
MEDIA PORTAL CONTENT
This file controls what students see. You can edit it by hand, or use
"Teacher login" on the portal page and download an updated copy.

years:        assignments, resources and equipment cards for each year,
              plus "page" (a link to the class web page, or "")
tutorials:    buttons that open a YouTube video  { title, url }
competitions: posters that scroll across the page
              { title, image, file, w, h, link, start, end }   (dates look like 2026-03-28)
links:        the Useful Resources section (cards and folders)

A card looks like    { "title": "...", "text": "...", "url": "...", "image": "" }
A folder looks like  { "title": "...", "text": "...", "items": [ ...cards... ] }
Keep the quote marks, keep a comma after each }, and don't delete [ ] brackets.
===================================================================== */
window.PORTAL = {
  "years": {
    "8": {
      "page": "",
      "assignments": [
        {
          "title": "Photography Unit",
          "text": "Learn one photography idea at a time: shots, composition, aperture, shutter speed, ISO and more.",
          "url": "/photography.html#unit",
          "image": ""
        }
      ],
      "resources": [],
      "equipment": []
    },
    "9": {
      "page": "",
      "assignments": [],
      "resources": [],
      "equipment": []
    },
    "10": {
      "page": "",
      "assignments": [],
      "resources": [],
      "equipment": []
    },
    "11": {
      "page": "",
      "assignments": [
        {
          "title": "Film Trailers: Genre and Structure",
          "text": "Task 2 · Genre, trailer structure and your production task. Work through all three parts with your group.",
          "url": "/film-trailers.html",
          "image": ""
        }
      ],
      "resources": [],
      "equipment": []
    },
    "12": {
      "page": "",
      "assignments": [],
      "resources": [],
      "equipment": []
    }
  },
  "tutorials": [],
  "competitions": [
    {
      "title": "News in my Neighbourhood",
      "image": "/uploads/competitions/news-in-my-neighbourhood.jpg",
      "file": "/uploads/competitions/news-in-my-neighbourhood.pdf",
      "w": 1061,
      "h": 1500,
      "link": "",
      "start": "",
      "end": "",
      "gen": false
    }
  ],
  "links": [
    {
      "title": "Stock Photo and Websites",
      "text": "Free photos and video footage for your project.",
      "items": [
        {
          "title": "Pexels",
          "text": "Free stock photos and videos.",
          "url": "https://www.pexels.com/",
          "image": ""
        },
        {
          "title": "Pixabay",
          "text": "Free stock video footage and clips.",
          "url": "https://pixabay.com/videos/",
          "image": ""
        },
        {
          "title": "Unsplash",
          "text": "Beautiful free photos.",
          "url": "https://unsplash.com/",
          "image": ""
        }
      ]
    },
    {
      "title": "Music Websites",
      "text": "Links to copyright free music to use in your project/s.",
      "items": [
        {
          "title": "Bensound",
          "text": "A website offering royalty-free music tracks that can be used in videos, films, podcasts, and other creative projects.",
          "url": "https://www.bensound.com/free-music-for-videos",
          "image": ""
        },
        {
          "title": "incompetech Music",
          "text": "A library of free music composed by Kevin MacLeod, available for download and use with attribution.",
          "url": "https://incompetech.com/music/royalty-free/music.html",
          "image": ""
        },
        {
          "title": "Pixabay",
          "text": "A free media platform providing music, sound effects, images, videos, and illustrations for creative projects.",
          "url": "https://pixabay.com/music/",
          "image": ""
        },
        {
          "title": "Purple Planet",
          "text": "A website offering free and premium background music tracks for videos, presentations, films, and educational projects.",
          "url": "https://www.purple-planet.com/home",
          "image": ""
        },
        {
          "title": "SoundBible.com",
          "text": "A collection of free sound effects and audio clips that can be downloaded for media and multimedia productions.",
          "url": "https://soundbible.com/",
          "image": ""
        },
        {
          "title": "List of other music websites",
          "text": "A webpage containing links to additional websites where users can find free or royalty-free music resources.",
          "url": "/uploads/resources/Music Websites/music-and-sound-effects---copyright-free-and-creative-commons-resources---subject-guides-at-monash-university.html",
          "image": ""
        },
        {
          "title": "Free Music Archive",
          "text": "Free music you can search by genre and licence. Credit the artist if asked.",
          "url": "https://freemusicarchive.org/",
          "image": ""
        }
      ]
    },
    {
      "title": "Sound Effects Websites",
      "text": "",
      "items": [
        {
          "title": "Sound Clips",
          "text": "A website offering a large collection of free sound effects and audio clips for videos, games, presentations, and multimedia projects.",
          "url": "https://soundbible.com/",
          "image": ""
        },
        {
          "title": "Freesound",
          "text": "A community-driven library where users upload and share free sound effects, ambient recordings, and audio samples under various licences.",
          "url": "https://freesound.org/",
          "image": ""
        },
        {
          "title": "List of other sound effect websites",
          "text": "",
          "url": "/uploads/resources/Sound Effects Websites/music-and-sound-effects---copyright-free-and-creative-commons-resources---subject-guides-at-monash-university.html",
          "image": ""
        },
        {
          "title": "Pixabay",
          "text": "A free media platform providing music, sound effects, images, videos, and illustrations for creative projects.",
          "url": "https://pixabay.com/sound-effects/",
          "image": ""
        }
      ]
    },
    {
      "title": "Stock Photo and Video Websites",
      "text": "",
      "items": [
        {
          "title": "Pexels",
          "text": "",
          "url": "https://www.pexels.com/",
          "image": ""
        },
        {
          "title": "Pixabay",
          "text": "",
          "url": "https://pixabay.com/videos/",
          "image": ""
        },
        {
          "title": "Unsplash",
          "text": "",
          "url": "https://unsplash.com/",
          "image": ""
        }
      ]
    },
    {
      "title": "DaFont",
      "text": "A site for finding font designs that can be downloaded and imported into Premiere Pro.",
      "url": "https://www.dafont.com/",
      "image": ""
    }
  ]
};
