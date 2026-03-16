(async () => {
  var s = JSON.parse(localStorage.getItem("brighton-pubs-session"));
  var r = await fetch("https://script.google.com/macros/s/AKfycbzP6KMj8JXpEYpzHDXyGpwuQw5xzjUGeeDgKEmNPPNn20CP4a0Wdpd1rcEo_PhPX79_/exec", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "bulkTag",
      password: s.password,
      user: s.name,
      tag: "PUBBL",
      names: [
        "The Actors",
        "Ancient Mariner",
        "Bath Arms",
        "Black Lion",
        "Dead Wax Social",
        "Earth & Stars",
        "East Street Tap",
        "Exchange",
        "Fiddlers Elbow",
        "Fortune Of War",
        "Fountainhead",
        "Freemasons",
        "Hope & Ruin",
        "Islingword Inn",
        "Mash Tun",
        "Mesmerist",
        "New Unity",
        "North Laine Brewhouse",
        "Oculist",
        "Old Albion",
        "Open House",
        "Saint George's Inn",
        "Shakespeare's Head",
        "Sidewinder",
        "Signalman",
        "Tempest",
        "Thomas Kemp",
        "Victory",
        "White Rabbit",
        "Worlds End"
      ]
    }),
    redirect: "follow"
  });
  console.log(await r.text());
})();
