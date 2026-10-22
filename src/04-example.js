<script>
/* Example diary shown before anyone imports an export. The films are real; the dates,
   ratings and likes are invented for the example. Columns:
   title, year, rating, liked, directors, cast, genres, countries, language, runtime, writers, cinematography, music */
const EXAMPLE_FILMS = [
  ["Parasite", 2019, 5, 1, "Bong Joon-ho", "Song Kang-ho|Lee Sun-kyun|Cho Yeo-jeong|Choi Woo-shik|Park So-dam|Lee Jung-eun", "Comedy|Thriller|Drama", "South Korea", "Korean", 133, "Bong Joon-ho|Han Jin-won", "Hong Kyung-pyo", "Jung Jae-il"],
  ["Memories of Murder", 2003, 4.5, 1, "Bong Joon-ho", "Song Kang-ho|Kim Sang-kyung|Kim Roe-ha|Song Jae-ho|Byun Hee-bong", "Crime|Drama|Thriller", "South Korea", "Korean", 132, "Bong Joon-ho|Shim Sung-bo", "Kim Hyung-koo", "Taro Iwashiro"],
  ["The Host", 2006, 3.5, 0, "Bong Joon-ho", "Song Kang-ho|Byun Hee-bong|Park Hae-il|Bae Doona|Go Ah-sung", "Horror|Drama|Science Fiction", "South Korea", "Korean", 120, "Bong Joon-ho|Ha Joon-won|Baek Chul-hyun", "Kim Hyung-koo", "Lee Byung-woo"],
  ["Decision to Leave", 2022, 4.5, 1, "Park Chan-wook", "Park Hae-il|Tang Wei|Lee Jung-hyun|Go Kyung-pyo", "Mystery|Romance|Thriller", "South Korea", "Korean", 138, "Park Chan-wook|Jeong Seo-kyeong", "Kim Ji-yong", "Cho Young-wuk"],
  ["Oldboy", 2003, 4, 0, "Park Chan-wook", "Choi Min-sik|Yoo Ji-tae|Kang Hye-jung", "Thriller|Mystery|Drama", "South Korea", "Korean", 120, "Park Chan-wook|Hwang Jo-yun|Lim Joon-hyung", "Chung Chung-hoon", "Cho Young-wuk"],
  ["The Handmaiden", 2016, 4.5, 1, "Park Chan-wook", "Kim Min-hee|Kim Tae-ri|Ha Jung-woo|Cho Jin-woong", "Thriller|Drama|Romance", "South Korea", "Korean", 145, "Park Chan-wook|Jeong Seo-kyeong", "Chung Chung-hoon", "Cho Young-wuk"],
  ["Past Lives", 2023, 4.5, 1, "Celine Song", "Greta Lee|Teo Yoo|John Magaro", "Drama|Romance", "USA|South Korea", "English", 106, "Celine Song", "Shabier Kirchner", "Christopher Bear|Daniel Rossen"],
  ["In the Mood for Love", 2000, 5, 1, "Wong Kar-wai", "Tony Leung Chiu-wai|Maggie Cheung|Rebecca Pan|Lai Chen", "Drama|Romance", "Hong Kong", "Cantonese", 98, "Wong Kar-wai", "Christopher Doyle|Mark Lee Ping-bing", "Michael Galasso|Shigeru Umebayashi"],
  ["Chungking Express", 1994, 4.5, 1, "Wong Kar-wai", "Brigitte Lin|Takeshi Kaneshiro|Tony Leung Chiu-wai|Faye Wong|Valerie Chow", "Drama|Romance|Comedy", "Hong Kong", "Cantonese", 102, "Wong Kar-wai", "Christopher Doyle|Andrew Lau", "Frankie Chan|Roel A. García"],
  ["2046", 2004, 4, 0, "Wong Kar-wai", "Tony Leung Chiu-wai|Gong Li|Faye Wong|Takuya Kimura|Zhang Ziyi", "Drama|Romance|Science Fiction", "Hong Kong", "Cantonese", 129, "Wong Kar-wai", "Christopher Doyle", "Shigeru Umebayashi|Peer Raben"],
  ["Fallen Angels", 1995, 4, 0, "Wong Kar-wai", "Leon Lai|Michelle Reis|Takeshi Kaneshiro|Charlie Yeung|Karen Mok", "Drama|Crime|Romance", "Hong Kong", "Cantonese", 99, "Wong Kar-wai", "Christopher Doyle", "Frankie Chan|Roel A. García"],
  ["Infernal Affairs", 2002, 4, 0, "Andrew Lau|Alan Mak", "Andy Lau|Tony Leung Chiu-wai|Anthony Wong|Eric Tsang", "Crime|Thriller", "Hong Kong", "Cantonese", 101, "Alan Mak|Felix Chong", "Andrew Lau|Lai Yiu-fai", "Chan Kwong-wing"],
  ["Lost in Translation", 2003, 4, 1, "Sofia Coppola", "Bill Murray|Scarlett Johansson|Giovanni Ribisi|Anna Faris", "Drama|Comedy|Romance", "USA|Japan", "English", 102, "Sofia Coppola", "Lance Acord", "Brian Reitzell|Kevin Shields"],
  ["The Grand Budapest Hotel", 2014, 4.5, 1, "Wes Anderson", "Ralph Fiennes|Tony Revolori|F. Murray Abraham|Adrien Brody|Willem Dafoe|Saoirse Ronan", "Comedy|Drama", "USA|Germany|UK", "English", 100, "Wes Anderson", "Robert Yeoman", "Alexandre Desplat"],
  ["Fantastic Mr. Fox", 2009, 4.5, 1, "Wes Anderson", "George Clooney|Meryl Streep|Jason Schwartzman|Bill Murray|Willem Dafoe", "Animation|Comedy|Family", "USA|UK", "English", 87, "Wes Anderson|Noah Baumbach", "Tristan Oliver", "Alexandre Desplat"],
  ["The Royal Tenenbaums", 2001, 4, 0, "Wes Anderson", "Gene Hackman|Anjelica Huston|Ben Stiller|Gwyneth Paltrow|Luke Wilson|Owen Wilson|Bill Murray", "Comedy|Drama", "USA", "English", 110, "Wes Anderson|Owen Wilson", "Robert Yeoman", "Mark Mothersbaugh"],
  ["Asteroid City", 2023, 3.5, 0, "Wes Anderson", "Jason Schwartzman|Scarlett Johansson|Tom Hanks|Jeffrey Wright|Tilda Swinton", "Comedy|Drama|Romance", "USA", "English", 105, "Wes Anderson", "Robert Yeoman", "Alexandre Desplat"],
  ["Moonrise Kingdom", 2012, 4, 1, "Wes Anderson", "Jared Gilman|Kara Hayward|Bruce Willis|Edward Norton|Bill Murray|Frances McDormand", "Comedy|Drama|Romance", "USA", "English", 94, "Wes Anderson|Roman Coppola", "Robert Yeoman", "Alexandre Desplat"],
  ["Rushmore", 1998, 3.5, 0, "Wes Anderson", "Jason Schwartzman|Bill Murray|Olivia Williams", "Comedy|Drama", "USA", "English", 93, "Wes Anderson|Owen Wilson", "Robert Yeoman", "Mark Mothersbaugh"],
  ["Oppenheimer", 2023, 4, 0, "Christopher Nolan", "Cillian Murphy|Emily Blunt|Matt Damon|Robert Downey Jr.|Florence Pugh", "Drama|History", "USA|UK", "English", 181, "Christopher Nolan", "Hoyte van Hoytema", "Ludwig Göransson"],
  ["Interstellar", 2014, 4.5, 1, "Christopher Nolan", "Matthew McConaughey|Anne Hathaway|Jessica Chastain|Michael Caine|Mackenzie Foy", "Science Fiction|Drama|Adventure", "USA|UK", "English", 169, "Jonathan Nolan|Christopher Nolan", "Hoyte van Hoytema", "Hans Zimmer"],
  ["The Prestige", 2006, 4, 0, "Christopher Nolan", "Hugh Jackman|Christian Bale|Michael Caine|Scarlett Johansson|Rebecca Hall", "Drama|Mystery|Thriller", "USA|UK", "English", 130, "Jonathan Nolan|Christopher Nolan", "Wally Pfister", "David Julyan"],
  ["Inception", 2010, 4, 0, "Christopher Nolan", "Leonardo DiCaprio|Joseph Gordon-Levitt|Elliot Page|Tom Hardy|Ken Watanabe|Cillian Murphy|Marion Cotillard|Michael Caine", "Action|Science Fiction|Adventure", "USA|UK", "English", 148, "Christopher Nolan", "Wally Pfister", "Hans Zimmer"],
  ["Dune: Part Two", 2024, 4.5, 1, "Denis Villeneuve", "Timothée Chalamet|Zendaya|Rebecca Ferguson|Javier Bardem|Josh Brolin|Austin Butler|Florence Pugh", "Science Fiction|Adventure", "USA|Canada", "English", 167, "Denis Villeneuve|Jon Spaihts", "Greig Fraser", "Hans Zimmer"],
  ["Dune", 2021, 3, 0, "Denis Villeneuve", "Timothée Chalamet|Rebecca Ferguson|Oscar Isaac|Josh Brolin|Stellan Skarsgård|Zendaya", "Science Fiction|Adventure", "USA|Canada", "English", 156, "Jon Spaihts|Denis Villeneuve|Eric Roth", "Greig Fraser", "Hans Zimmer"],
  ["Arrival", 2016, 4.5, 1, "Denis Villeneuve", "Amy Adams|Jeremy Renner|Forest Whitaker|Michael Stuhlbarg", "Science Fiction|Drama", "USA|Canada", "English", 116, "Eric Heisserer", "Bradford Young", "Jóhann Jóhannsson"],
  ["Blade Runner 2049", 2017, 4.5, 0, "Denis Villeneuve", "Ryan Gosling|Harrison Ford|Ana de Armas|Sylvia Hoeks|Robin Wright|Jared Leto", "Science Fiction|Drama", "USA|UK|Canada", "English", 164, "Hampton Fancher|Michael Green", "Roger Deakins", "Benjamin Wallfisch|Hans Zimmer"],
  ["Prisoners", 2013, 4, 0, "Denis Villeneuve", "Hugh Jackman|Jake Gyllenhaal|Viola Davis|Maria Bello|Terrence Howard|Melissa Leo|Paul Dano", "Crime|Drama|Thriller", "USA", "English", 153, "Aaron Guzikowski", "Roger Deakins", "Jóhann Jóhannsson"],
  ["Sicario", 2015, 4, 0, "Denis Villeneuve", "Emily Blunt|Benicio del Toro|Josh Brolin|Daniel Kaluuya", "Action|Crime|Thriller", "USA", "English", 121, "Taylor Sheridan", "Roger Deakins", "Jóhann Jóhannsson"],
  ["Enemy", 2013, 3.5, 0, "Denis Villeneuve", "Jake Gyllenhaal|Mélanie Laurent|Sarah Gadon|Isabella Rossellini", "Mystery|Thriller", "Canada|Spain", "English", 91, "Javier Gullón", "Nicolas Bolduc", "Danny Bensi|Saunder Jurriaans"],
  ["Nightcrawler", 2014, 4, 0, "Dan Gilroy", "Jake Gyllenhaal|Rene Russo|Riz Ahmed|Bill Paxton", "Crime|Thriller|Drama", "USA", "English", 117, "Dan Gilroy", "Robert Elswit", "James Newton Howard"],
  ["Zodiac", 2007, 4.5, 1, "David Fincher", "Jake Gyllenhaal|Mark Ruffalo|Robert Downey Jr.|Anthony Edwards|Brian Cox", "Crime|Drama|Mystery", "USA", "English", 157, "James Vanderbilt", "Harris Savides", "David Shire"],
  ["Brokeback Mountain", 2005, 4, 0, "Ang Lee", "Heath Ledger|Jake Gyllenhaal|Michelle Williams|Anne Hathaway|Randy Quaid", "Drama|Romance", "USA|Canada", "English", 134, "Larry McMurtry|Diana Ossana", "Rodrigo Prieto", "Gustavo Santaolalla"],
  ["Donnie Darko", 2001, 3.5, 0, "Richard Kelly", "Jake Gyllenhaal|Jena Malone|Maggie Gyllenhaal|Drew Barrymore|Mary McDonnell|Patrick Swayze", "Drama|Mystery|Science Fiction", "USA", "English", 113, "Richard Kelly", "Steven Poster", "Michael Andrews"],
  ["The Social Network", 2010, 4.5, 1, "David Fincher", "Jesse Eisenberg|Andrew Garfield|Justin Timberlake|Armie Hammer|Rooney Mara", "Drama", "USA", "English", 120, "Aaron Sorkin", "Jeff Cronenweth", "Trent Reznor|Atticus Ross"],
  ["Gone Girl", 2014, 4, 0, "David Fincher", "Ben Affleck|Rosamund Pike|Neil Patrick Harris|Tyler Perry|Carrie Coon", "Mystery|Thriller|Drama", "USA", "English", 149, "Gillian Flynn", "Jeff Cronenweth", "Trent Reznor|Atticus Ross"],
  ["Fight Club", 1999, 3, 0, "David Fincher", "Edward Norton|Brad Pitt|Helena Bonham Carter|Meat Loaf|Jared Leto", "Drama|Thriller", "USA|Germany", "English", 139, "Jim Uhls", "Jeff Cronenweth", "The Dust Brothers"],
  ["La La Land", 2016, 3, 0, "Damien Chazelle", "Ryan Gosling|Emma Stone|John Legend|Rosemarie DeWitt|J.K. Simmons", "Comedy|Drama|Romance|Music", "USA", "English", 129, "Damien Chazelle", "Linus Sandgren", "Justin Hurwitz"],
  ["Whiplash", 2014, 4.5, 1, "Damien Chazelle", "Miles Teller|J.K. Simmons|Melissa Benoist|Paul Reiser", "Drama|Music", "USA", "English", 107, "Damien Chazelle", "Sharone Meir", "Justin Hurwitz"],
  ["Drive", 2011, 4, 0, "Nicolas Winding Refn", "Ryan Gosling|Carey Mulligan|Bryan Cranston|Albert Brooks|Oscar Isaac|Ron Perlman", "Crime|Drama|Thriller", "USA", "English", 100, "Hossein Amini", "Newton Thomas Sigel", "Cliff Martinez"],
  ["Poor Things", 2023, 4, 1, "Yorgos Lanthimos", "Emma Stone|Mark Ruffalo|Willem Dafoe|Ramy Youssef", "Science Fiction|Romance|Comedy", "UK|USA|Ireland", "English", 141, "Tony McNamara", "Robbie Ryan", "Jerskin Fendrix"],
  ["The Favourite", 2018, 4, 0, "Yorgos Lanthimos", "Olivia Colman|Emma Stone|Rachel Weisz|Nicholas Hoult|Joe Alwyn", "Drama|History|Comedy", "UK|Ireland|USA", "English", 119, "Deborah Davis|Tony McNamara", "Robbie Ryan", ""],
  ["The Lobster", 2015, 3.5, 0, "Yorgos Lanthimos", "Colin Farrell|Rachel Weisz|Jessica Barden|Olivia Colman|Ben Whishaw|Léa Seydoux|John C. Reilly", "Comedy|Drama|Romance", "Ireland|UK|Greece|France|Netherlands", "English", 119, "Yorgos Lanthimos|Efthimis Filippou", "Thimios Bakatakis", ""],
  ["Kinds of Kindness", 2024, 3, 0, "Yorgos Lanthimos", "Emma Stone|Jesse Plemons|Willem Dafoe|Margaret Qualley|Hong Chau", "Comedy|Drama", "Ireland|UK|USA", "English", 165, "Yorgos Lanthimos|Efthimis Filippou", "Robbie Ryan", "Jerskin Fendrix"],
  ["Portrait of a Lady on Fire", 2019, 5, 1, "Céline Sciamma", "Noémie Merlant|Adèle Haenel|Luàna Bajrami|Valeria Golino", "Drama|Romance|History", "France", "French", 122, "Céline Sciamma", "Claire Mathon", "Para One|Arthur Simonini"],
  ["Anatomy of a Fall", 2023, 4, 0, "Justine Triet", "Sandra Hüller|Swann Arlaud|Milo Machado-Graner|Antoine Reinartz", "Drama|Crime|Mystery", "France", "French", 151, "Justine Triet|Arthur Harari", "Simon Beaufils", ""],
  ["The Zone of Interest", 2023, 4, 0, "Jonathan Glazer", "Christian Friedel|Sandra Hüller", "Drama|History|War", "UK|Poland|USA", "German", 105, "Jonathan Glazer", "Łukasz Żal", "Mica Levi"],
  ["Spirited Away", 2001, 5, 1, "Hayao Miyazaki", "Rumi Hiiragi|Miyu Irino|Mari Natsuki|Takashi Naito|Yasuko Sawaguchi", "Animation|Family|Fantasy", "Japan", "Japanese", 125, "Hayao Miyazaki", "Atsushi Okui", "Joe Hisaishi"],
  ["My Neighbor Totoro", 1988, 4.5, 1, "Hayao Miyazaki", "Noriko Hidaka|Chika Sakamoto|Shigesato Itoi|Sumi Shimamoto", "Animation|Family|Fantasy", "Japan", "Japanese", 86, "Hayao Miyazaki", "Hisao Shirai", "Joe Hisaishi"],
  ["Princess Mononoke", 1997, 4.5, 0, "Hayao Miyazaki", "Yoji Matsuda|Yuriko Ishida|Yuko Tanaka|Kaoru Kobayashi|Masahiko Nishimura", "Animation|Fantasy|Adventure", "Japan", "Japanese", 134, "Hayao Miyazaki", "Atsushi Okui", "Joe Hisaishi"],
  ["Perfect Days", 2023, 4.5, 1, "Wim Wenders", "Koji Yakusho|Tokio Emoto|Arisa Nakano|Aoi Yamada", "Drama", "Japan|Germany", "Japanese", 124, "Wim Wenders|Takuma Takasaki", "Franz Lustig", ""],
  ["Drive My Car", 2021, 4, 0, "Ryusuke Hamaguchi", "Hidetoshi Nishijima|Toko Miura|Reika Kirishima|Masaki Okada", "Drama", "Japan", "Japanese", 179, "Ryusuke Hamaguchi|Takamasa Oe", "Hidetoshi Shinomiya", "Eiko Ishibashi"],
  ["Aftersun", 2022, 4.5, 1, "Charlotte Wells", "Paul Mescal|Frankie Corio|Celia Rowlson-Hall", "Drama", "UK|USA", "English", 102, "Charlotte Wells", "Gregory Oke", "Oliver Coates"],
  ["All of Us Strangers", 2023, 4, 0, "Andrew Haigh", "Andrew Scott|Paul Mescal|Jamie Bell|Claire Foy", "Drama|Romance|Fantasy", "UK|USA", "English", 105, "Andrew Haigh", "Jamie D. Ramsay", "Emilie Levienaise-Farrouch"],
  ["Lady Bird", 2017, 4, 1, "Greta Gerwig", "Saoirse Ronan|Laurie Metcalf|Tracy Letts|Lucas Hedges|Timothée Chalamet|Beanie Feldstein", "Comedy|Drama", "USA", "English", 94, "Greta Gerwig", "Sam Levy", "Jon Brion"],
  ["Little Women", 2019, 4, 0, "Greta Gerwig", "Saoirse Ronan|Emma Watson|Florence Pugh|Eliza Scanlen|Laura Dern|Timothée Chalamet|Meryl Streep", "Drama|Romance", "USA", "English", 135, "Greta Gerwig", "Yorick Le Saux", "Alexandre Desplat"],
  ["Frances Ha", 2012, 4, 1, "Noah Baumbach", "Greta Gerwig|Mickey Sumner|Adam Driver|Michael Zegen", "Comedy|Drama|Romance", "USA", "English", 86, "Noah Baumbach|Greta Gerwig", "Sam Levy", ""],
  ["Marriage Story", 2019, 4, 0, "Noah Baumbach", "Adam Driver|Scarlett Johansson|Laura Dern|Alan Alda|Ray Liotta", "Drama|Comedy|Romance", "USA|UK", "English", 137, "Noah Baumbach", "Robbie Ryan", "Randy Newman"],
  ["Paterson", 2016, 4, 1, "Jim Jarmusch", "Adam Driver|Golshifteh Farahani|Barry Shabaka Henley", "Drama|Comedy|Romance", "USA|Germany|France", "English", 118, "Jim Jarmusch", "Frederick Elmes", "SQÜRL"],
  ["Call Me by Your Name", 2017, 4, 0, "Luca Guadagnino", "Armie Hammer|Timothée Chalamet|Michael Stuhlbarg|Amira Casar|Esther Garrel", "Drama|Romance", "Italy|France|USA|Brazil", "English", 132, "James Ivory", "Sayombhu Mukdeeprom", ""],
  ["Challengers", 2024, 4, 1, "Luca Guadagnino", "Zendaya|Josh O'Connor|Mike Faist", "Drama|Romance", "USA|Italy", "English", 131, "Justin Kuritzkes", "Sayombhu Mukdeeprom", "Trent Reznor|Atticus Ross"],
  ["Mulholland Drive", 2001, 4.5, 1, "David Lynch", "Naomi Watts|Laura Harring|Justin Theroux|Ann Miller|Robert Forster", "Drama|Mystery|Thriller", "France|USA", "English", 147, "David Lynch", "Peter Deming", "Angelo Badalamenti"],
  ["Perfect Blue", 1997, 4, 0, "Satoshi Kon", "Junko Iwao|Rica Matsumoto|Shinpachi Tsuji|Masaaki Okura", "Animation|Thriller|Horror", "Japan", "Japanese", 81, "Sadayuki Murai", "Hisao Shirai", "Masahiro Ikumi"],
  ["Everything Everywhere All at Once", 2022, 4.5, 1, "Daniel Kwan|Daniel Scheinert", "Michelle Yeoh|Ke Huy Quan|Stephanie Hsu|Jamie Lee Curtis|James Hong", "Action|Adventure|Science Fiction|Comedy", "USA", "English", 140, "Daniel Kwan|Daniel Scheinert", "Larkin Seiple", "Son Lux"],
  ["Crouching Tiger, Hidden Dragon", 2000, 4, 0, "Ang Lee", "Chow Yun-fat|Michelle Yeoh|Zhang Ziyi|Chang Chen", "Action|Drama|Romance", "Taiwan|Hong Kong|USA|China", "Mandarin", 120, "Wang Hui-ling|James Schamus|Tsai Kuo-jung", "Peter Pau", "Tan Dun"],
  ["Burning", 2018, 4.5, 1, "Lee Chang-dong", "Yoo Ah-in|Steven Yeun|Jeon Jong-seo", "Mystery|Drama|Thriller", "South Korea", "Korean", 148, "Oh Jung-mi|Lee Chang-dong", "Hong Kyung-pyo", "Mowg"],
  ["Minari", 2020, 4, 0, "Lee Isaac Chung", "Steven Yeun|Han Ye-ri|Alan Kim|Noel Kate Cho|Youn Yuh-jung|Will Patton", "Drama", "USA", "Korean", 115, "Lee Isaac Chung", "Lachlan Milne", "Emile Mosseri"],
  ["Nope", 2022, 3.5, 0, "Jordan Peele", "Daniel Kaluuya|Keke Palmer|Steven Yeun|Brandon Perea|Michael Wincott", "Horror|Mystery|Science Fiction", "USA", "English", 130, "Jordan Peele", "Hoyte van Hoytema", "Michael Abels"],
  ["Get Out", 2017, 4, 0, "Jordan Peele", "Daniel Kaluuya|Allison Williams|Bradley Whitford|Catherine Keener|Caleb Landry Jones|LilRel Howery", "Horror|Mystery|Thriller", "USA", "English", 104, "Jordan Peele", "Toby Oliver", "Michael Abels"],
  ["Before Sunrise", 1995, 4.5, 1, "Richard Linklater", "Ethan Hawke|Julie Delpy", "Drama|Romance", "USA|Austria|Switzerland", "English", 101, "Richard Linklater|Kim Krizan", "Lee Daniel", "Fred Frith"],
  ["Before Sunset", 2004, 5, 1, "Richard Linklater", "Ethan Hawke|Julie Delpy", "Drama|Romance", "USA", "English", 80, "Richard Linklater|Julie Delpy|Ethan Hawke|Kim Krizan", "Lee Daniel", ""],
  ["Before Midnight", 2013, 4, 0, "Richard Linklater", "Ethan Hawke|Julie Delpy", "Drama|Romance", "USA|Greece", "English", 109, "Richard Linklater|Julie Delpy|Ethan Hawke", "Christos Voudouris", "Graham Reynolds"],
];

/* Example crowd scores, roughly what TMDB users give these films (out of 10, then how many votes). */
const EXAMPLE_CROWD = {
  "Parasite": [8.5, 19000], "Memories of Murder": [8.1, 3700], "The Host": [6.9, 2600], "Decision to Leave": [7.3, 1300],
  "Oldboy": [8.2, 8800], "The Handmaiden": [8.2, 3600], "Past Lives": [7.7, 1700], "In the Mood for Love": [8.1, 3100],
  "Chungking Express": [7.9, 1900], "2046": [7.4, 900], "Fallen Angels": [7.5, 800], "Infernal Affairs": [7.8, 1800],
  "Lost in Translation": [7.4, 7600], "The Grand Budapest Hotel": [8.0, 15000], "Fantastic Mr. Fox": [7.8, 5900],
  "The Royal Tenenbaums": [7.3, 3300], "Asteroid City": [6.4, 1500], "Moonrise Kingdom": [7.6, 6900], "Rushmore": [7.1, 1900],
  "Oppenheimer": [8.1, 10000], "Interstellar": [8.4, 37000], "The Prestige": [8.2, 16000], "Inception": [8.4, 37000],
  "Dune: Part Two": [8.1, 7500], "Dune": [7.8, 13000], "Arrival": [7.6, 18000], "Blade Runner 2049": [7.6, 14000],
  "Prisoners": [8.1, 12000], "Sicario": [7.4, 9000], "Enemy": [6.9, 4600], "Nightcrawler": [7.7, 11000], "Zodiac": [7.5, 11000],
  "Brokeback Mountain": [7.8, 6500], "Donnie Darko": [7.8, 12000], "The Social Network": [7.4, 13000], "Gone Girl": [7.9, 19000],
  "Fight Club": [8.4, 30000], "La La Land": [7.9, 17000], "Whiplash": [8.4, 15000], "Drive": [7.6, 13000], "Poor Things": [7.7, 4500],
  "The Favourite": [7.1, 6000], "The Lobster": [6.7, 5500], "Kinds of Kindness": [6.6, 900], "Portrait of a Lady on Fire": [8.1, 2700],
  "Anatomy of a Fall": [7.7, 2000], "The Zone of Interest": [7.0, 1700], "Spirited Away": [8.5, 17000], "My Neighbor Totoro": [8.1, 8500],
  "Princess Mononoke": [8.3, 8200], "Perfect Days": [7.8, 900], "Drive My Car": [7.4, 1000], "Aftersun": [7.6, 1500],
  "All of Us Strangers": [7.4, 900], "Lady Bird": [7.3, 9200], "Little Women": [7.9, 7000], "Frances Ha": [7.2, 1600],
  "Marriage Story": [7.7, 7400], "Paterson": [7.1, 1600], "Call Me by Your Name": [8.1, 12000], "Challengers": [7.0, 1600],
  "Mulholland Drive": [7.7, 5000], "Perfect Blue": [8.3, 2500], "Everything Everywhere All at Once": [7.8, 7000],
  "Crouching Tiger, Hidden Dragon": [7.3, 3900], "Burning": [7.2, 1600], "Minari": [7.2, 1700], "Nope": [6.8, 5000],
  "Get Out": [7.6, 17000], "Before Sunrise": [7.9, 4400], "Before Sunset": [7.8, 3200], "Before Midnight": [7.6, 2500],
};

/* Films only the example friends have seen, so Compare has something to suggest. Same columns as
   the table above (without rating and like), then the example crowd score and votes. */
const EXAMPLE_EXTRA = [
  ["Hereditary", 2018, "Ari Aster", "Toni Collette|Alex Wolff|Milly Shapiro|Gabriel Byrne", "Horror|Mystery|Thriller", "USA", "English", 127, "Ari Aster", "Pawel Pogorzelski", "Colin Stetson", 7.3, 9000],
  ["The Thing", 1982, "John Carpenter", "Kurt Russell|Wilford Brimley|Keith David|T.K. Carter", "Horror|Science Fiction|Mystery", "USA", "English", 109, "Bill Lancaster", "Dean Cundey", "Ennio Morricone", 8.1, 7000],
  ["Alien", 1979, "Ridley Scott", "Sigourney Weaver|Tom Skerritt|Veronica Cartwright|Harry Dean Stanton|John Hurt", "Horror|Science Fiction", "UK|USA", "English", 117, "Dan O'Bannon", "Derek Vanlint", "Jerry Goldsmith", 8.2, 15000],
  ["Heat", 1995, "Michael Mann", "Al Pacino|Robert De Niro|Val Kilmer|Jon Voight", "Crime|Drama|Action", "USA", "English", 170, "Michael Mann", "Dante Spinotti", "Elliot Goldenthal", 7.9, 7500],
  ["Seven Samurai", 1954, "Akira Kurosawa", "Toshiro Mifune|Takashi Shimura|Keiko Tsushima", "Action|Drama", "Japan", "Japanese", 207, "Akira Kurosawa|Shinobu Hashimoto|Hideo Oguni", "Asakazu Nakai", "Fumio Hayasaka", 8.5, 3500],
  ["The Shining", 1980, "Stanley Kubrick", "Jack Nicholson|Shelley Duvall|Danny Lloyd|Scatman Crothers", "Horror|Thriller", "UK|USA", "English", 144, "Stanley Kubrick|Diane Johnson", "John Alcott", "Wendy Carlos|Rachel Elkind", 8.2, 18000],
  ["Amélie", 2001, "Jean-Pierre Jeunet", "Audrey Tautou|Mathieu Kassovitz|Rufus|Lorella Cravotta", "Comedy|Romance", "France|Germany", "French", 122, "Guillaume Laurant|Jean-Pierre Jeunet", "Bruno Delbonnel", "Yann Tiersen", 7.9, 11000],
  ["Midsommar", 2019, "Ari Aster", "Florence Pugh|Jack Reynor|William Jackson Harper|Will Poulter", "Horror|Drama|Mystery", "USA|Sweden", "English", 148, "Ari Aster", "Pawel Pogorzelski", "Bobby Krlic", 7.1, 8000],
  ["Superbad", 2007, "Greg Mottola", "Jonah Hill|Michael Cera|Christopher Mintz-Plasse|Seth Rogen|Bill Hader", "Comedy", "USA", "English", 113, "Seth Rogen|Evan Goldberg", "Russ T. Alsobrook", "Lyle Workman", 7.2, 8000],
  ["Paddington 2", 2017, "Paul King", "Ben Whishaw|Hugh Grant|Hugh Bonneville|Sally Hawkins|Brendan Gleeson", "Family|Comedy|Adventure", "UK|France|USA", "English", 104, "Paul King|Simon Farnaby", "Erik Wilson", "Dario Marianelli", 7.6, 3200],
];
// Sample reviews for the example diary, in a casual Letterboxd voice. Invented for the example.
const EXAMPLE_REVIEWS = {
  "Parasite": "Every staircase in this house is doing work. The swerve in the last act still knocks the air out of me.",
  "In the Mood for Love": "Corridors, cigarette smoke and the same waltz again and again. Longing has never looked this beautiful.",
  "Portrait of a Lady on Fire": "Turn around.\n\nThe final shot is one of the most beautiful endings I've seen. Patient, precise and burning underneath.",
  "Before Sunset": "Eighty minutes of walking and talking, and I wanted eighty more. The ending is perfect.",
  "Spirited Away": "Pure imagination. The train across the water is the most peaceful scene I know, and I cried again.",
  "Fight Club": "Loud, smug and tiresome on a rewatch. Great score, though, and the cast is having fun.",
  "La La Land": "Gorgeous to look at, but the songs left me cold and the romance felt thin.",
  "Dune": "Beautiful, but it's half a story and it feels like it. Loud and slow at the same time.",
  "Asteroid City": "Pretty dioramas with very little underneath. Beautiful, but cold.",
  "Aftersun": "Quietly devastating. That last dance under the strobe lights wrecked me. Paul Mescal is perfect.",
  "Burning": "A slow burn that never lets you look away. Steven Yeun is unsettling and perfect.",
  "Interstellar": "Big, earnest and very loud. The docking scene still works on me every time.",
  "Kinds of Kindness": "Three stories, one too many. Strange for the sake of strange, and tiresome by the end.",
  "Prisoners": "Grim, gripping, and two and a half hours that fly by. Gyllenhaal's blinking detective is a great creation.",
  "Drive My Car": "Three hours of grief, theatre and long drives, and I didn't want it to end. Patient and beautiful.",
  "Decision to Leave": "Sly, romantic and endlessly clever. Park Chan-wook at his most playful, and the ending is devastating.",
  "Chungking Express": "California Dreamin' forever. Pure joy, and Faye Wong is perfect.",
  "Whiplash": "Not quite my tempo. Tense as a thriller, and that finale is perfect.",
};
const EXAMPLE_WATCHLIST = [["Seven Samurai", 1954], ["The Thing", 1982], ["Amélie", 2001]];

/* Turns the table above into the same shape an imported export produces:
   a library of films plus diary entries, and a metadata map keyed by film. */
function buildExample() {
  let seed = 20261021;
  const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const start = Date.UTC(2021, 0, 4), end = Date.UTC(2026, 9, 18), day = 864e5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  // Never before a film came out; later years a little busier; and the example's taste drifts
  // from English-language films toward world cinema, so Insights has a change to find.
  const pick = (year, lang) => {
    const lo = Math.max(start, Date.UTC(year, 2, 1));
    let p = Math.pow(rand(), 0.8);
    p = lang === "English" ? p * 0.8 : 0.35 + 0.65 * p;
    return lo + Math.floor(p * (end - lo) / day) * day;
  };
  const logDate = (t) => iso(t + (rand() < 0.25 ? (1 + Math.floor(rand() * 5)) * day : 0));
  const rows = { profile: [{ Username: "example" }], watched: [], ratings: [], diary: [], likes: [], reviews: [] };
  const meta = {};
  const split = (s) => s ? s.split("|") : [];
  EXAMPLE_FILMS.forEach((f, i) => {
    const [name, year, rating, liked, d, c, g, k, l, r, w, p, m] = f;
    const base = { Name: name, Year: String(year), "Letterboxd URI": "" };
    rows.watched.push({ ...base, Date: iso(start) });
    rows.ratings.push({ ...base, Rating: String(rating) });
    if (liked) rows.likes.push(base);
    const crowd = EXAMPLE_CROWD[name] || [];
    meta[filmKey(name, year)] = { src: "example", d: split(d), c: split(c), g: split(g), k: split(k), l, r, w: split(w), p: split(p), m: split(m), va: crowd[0], vc: crowd[1] };
    if (i % 9 === 4) return; // logged as watched without a diary date
    const first = pick(year, l);
    rows.diary.push({ ...base, Date: logDate(first), "Watched Date": iso(first), Rating: String(rating), Rewatch: "", Tags: "" });
    if (rating >= 4.5 && rand() < 0.55) {
      const again = first + Math.floor(rand() * (end - first) / day) * day;
      if (again > first) rows.diary.push({ ...base, Date: logDate(again), "Watched Date": iso(again), Rating: String(rating), Rewatch: "Yes", Tags: "" });
    }
    if (EXAMPLE_REVIEWS[name]) rows.reviews.push({ ...base, Date: logDate(first), "Watched Date": iso(first), Rating: String(rating), Review: EXAMPLE_REVIEWS[name] });
  });
  for (const [name, year, d, c, g, k, l, r, w, p, m, va, vc] of EXAMPLE_EXTRA)
    meta[filmKey(name, year)] = { src: "example", d: split(d), c: split(c), g: split(g), k: split(k), l, r, w: split(w), p: split(p), m: split(m), va, vc };
  rows.watchlist = EXAMPLE_WATCHLIST.map(([Name, Year]) => ({ Name, Year: String(Year) }));
  return { rows, meta };
}

/* Two made-up members for Compare: one leans to horror and science fiction, one to comedy and romance.
   They rate the example films from the "you" diary's ratings, nudged by their tastes, and each has
   seen a few films "you" haven't. */
function buildExampleFriends() {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const half = (x) => Math.min(5, Math.max(0.5, Math.round(x * 2) / 2));
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const people = [
    { id: "ex-a", name: "Friend A", likes: ["Horror", "Science Fiction", "Thriller", "Crime"], dislikes: ["Romance", "Family"], keep: 0.55,
      extra: ["Hereditary", "The Thing", "Alien", "Heat", "The Shining", "Midsommar"], watchlist: ["Seven Samurai", "Paddington 2"] },
    { id: "ex-b", name: "Friend B", likes: ["Comedy", "Romance", "Animation", "Family"], dislikes: ["Horror", "Thriller"], keep: 0.5,
      extra: ["Amélie", "Superbad", "Paddington 2", "Seven Samurai"], watchlist: ["The Thing", "The Shining"] },
  ];
  const films = [...EXAMPLE_FILMS.map((f) => ({ name: f[0], year: f[1], base: f[2], g: f[6].split("|"), extra: false })),
    ...EXAMPLE_EXTRA.map((f) => ({ name: f[0], year: f[1], base: f[11] / 2, g: f[4].split("|"), extra: true }))];
  return people.map((P) => {
    const rows = { profile: [{ Username: P.name }], watched: [], ratings: [], diary: [], likes: [], reviews: [], watchlist: [] };
    for (const f of films) {
      const taste = (f.g.some((g) => P.likes.includes(g)) ? 1 : 0) - (f.g.some((g) => P.dislikes.includes(g)) ? 1 : 0);
      if (f.extra ? !P.extra.includes(f.name) : rand() > P.keep + 0.2 * taste) continue;
      const rating = half(f.base + (taste > 0 ? 1 : taste < 0 ? -1.5 : 0) + (rand() < 0.3 ? -0.5 : rand() < 0.3 ? 0.5 : 0));
      const lo = Math.max(Date.UTC(2022, 0, 1), Date.UTC(f.year, 2, 1)), hi = Date.UTC(2026, 9, 15);
      const date = iso(lo + Math.floor(rand() * (hi - lo) / 864e5) * 864e5);
      const base = { Name: f.name, Year: String(f.year) };
      rows.watched.push(base);
      rows.ratings.push({ ...base, Rating: String(rating) });
      rows.diary.push({ ...base, Date: date, "Watched Date": date, Rating: String(rating), Rewatch: "" });
      if (rating >= 4.5) rows.likes.push(base);
    }
    rows.watchlist = P.watchlist.map((n) => { const f = films.find((x) => x.name === n); return { Name: f.name, Year: String(f.year) }; });
    return { id: P.id, name: P.name, example: true, rows };
  });
}
</script>
