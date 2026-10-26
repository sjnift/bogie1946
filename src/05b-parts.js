<script>
/* ---------- how a bit part is credited (for `smallPart`, 05-core) ----------
   A part credited only as one of the people there: a generic person ("Guy", "Man in Black Suit", "Wedding Guest",
   "Onlooker at Diner") or a numbered one ("Cop #2", "First Reporter", "Other Doctor"). The words come from the
   characters TMDB gives across about 3,000 films (the owner's, a guest's and a list of classics, Oct 2026):
   BIT_PEOPLE are the people present, BIT_ROLES the people a part can be (jobs, ranks, kin…), BIT_WORDS what they're
   described with (dictionary words seen four or more times that aren't first names). A word outside all three is
   taken for a name, and the part for someone in particular ("Mike's Girl", "Mr. Chow", "Billy the Kid"), as is a
   part that starts "The" ("The Kid", "The Big Man"). */
const BIT_SET = (s) => new Set(s.split(/\s+/).filter(Boolean));
const BIT_PEOPLE = BIT_SET(`
man men guy guys boy boys girl girls woman women kid kids child children baby babies teen teens teenager teenagers
youth youths lad lads lass lasses dude dudes chap chaps fellow fellows bloke blokes gentleman gentlemen lady ladies
person persons people couple stranger strangers patron patrons customer customers client clients guest guests
visitor visitors passenger passengers commuter commuters tourist tourists traveler travelers traveller travellers
pedestrian pedestrians passerby passersby bystander bystanders onlooker onlookers spectator spectators audience
crowd attendee attendees mourner mourners partygoer partygoers reveler revelers reveller revellers diner diners
shopper shoppers fan fans groupie groupies student students pupil pupils villager villagers townsman townsmen
townswoman townspeople townsperson citizen citizens resident residents local locals extra extras evacuee evacuees
member members drinker drinkers gambler gamblers dancer dancers clubber clubgoer moviegoer theatergoer churchgoer
protester protesters picketer rioter rioters prisoner prisoners inmate inmates hostage hostages survivor survivors
victim victims`);
const BIT_ROLES = BIT_SET(`
man men guy guys boy boys girl girls woman women kid kids child children baby babies teen teenager youth lad lass
dude chap fellow bloke gentleman gentlemen lady ladies person people couple twin twins mother father mom dad mum
mama papa son daughter wife husband sister brother uncle aunt grandmother grandfather grandma grandpa granny nephew
niece cousin bride groom bridesmaid widow widower orphan fiance fiancee friend girlfriend boyfriend neighbor
neighbour stranger visitor guest host hostess fan groupie lover date partner roommate colleague coworker classmate
teammate officer cop cops policeman policewoman police detective inspector constable gendarme patrolman trooper
sheriff deputy marshal ranger agent spy guard guards bodyguard bouncer doorman watchman warden jailer soldier
soldiers sailor seaman marine pilot copilot airman cadet recruit private corporal sergeant lieutenant captain major
colonel general admiral commander commando mercenary sniper gunner rifleman infantryman thug thugs henchman goon
goons gangster gangsters mobster hood hoodlum gunman hitman assassin killer robber thief burglar kidnapper bandit
pirate outlaw convict prisoner inmate captive hostage victim witness suspect survivor waiter waitress bartender
barman barmaid headwaiter maitre sommelier cook chef baker butcher grocer vendor seller salesman saleswoman
shopkeeper storekeeper clerk cashier teller receptionist secretary typist operator driver cabbie chauffeur conductor
porter bellboy bellhop valet usher attendant steward stewardess courier messenger postman mailman milkman newsboy
paperboy delivery doctor doc nurse surgeon dentist pharmacist psychiatrist therapist paramedic medic orderly coroner
midwife scientist technician engineer mechanic janitor cleaner maid butler housekeeper nanny gardener servant
footman reporter journalist photographer cameraman correspondent newscaster anchor anchorman anchorwoman announcer
interviewer commentator editor writer author poet critic producer director actor actress extra model singer dancer
dancers musician drummer pianist guitarist violinist bassist performer entertainer clown magician acrobat stripper
showgirl chorus student students pupil schoolgirl schoolboy teacher professor principal headmaster headmistress
tutor lecturer librarian coach referee umpire player athlete boxer wrestler fighter jockey trainer priest vicar
minister preacher pastor reverend bishop cardinal monk nun rabbi imam missionary choirboy deacon abbot judge juror
lawyer attorney prosecutor bailiff senator mayor governor president ambassador diplomat official delegate politician
councilman aide chairman farmer rancher cowboy villager townsman townswoman peasant citizen resident local native
migrant refugee pioneer prospector miner trapper hunter fisherman logger patron customer client passenger commuter
tourist traveler traveller pedestrian passerby bystander onlooker spectator spectators audience crowd attendee
mourner partygoer reveler conventioneer protester worker workers workman employee employees manager boss owner
proprietor landlord landlady tenant foreman supervisor executive businessman businesswoman banker broker dealer
gambler croupier trader merchant peddler assistant intern apprentice trainee member members leader follower staffer
staff crewman crew drunk junkie addict pusher pimp hooker prostitute beggar tramp hobo bum hippie punk biker gypsy
zombie zombies vampire ghost monster creature alien robot android mutant witch wizard elf orc goblin dwarf giant
spirit angel demon devil king queen prince princess duke duchess count countess baron baroness lord knight squire
courtier jester page herald monsieur madame mister madam miss mrs mr ms sir dame herr frau senor senora signor
signora`);
const BIT_WORDS = BIT_SET(`
at the in additional of party young on with old club hotel bar gang security courtroom chief train ship german bus
little role station orchestra team restaurant wedding news hall street office first nightclub room hospital car
radio french school female black bank cafe dance store slave band second taxi house airport prison head shop barfly
court master new red truck diner military male minor tech park white big elevator who ballet senate army and warrior
desk chinese choir night swat family board patient fat one from fight show stage high part samurai brown dog cab
casino undetermined bit other special theatre church city singing building town ticket to dinner awards beach poker
helicopter state teenage phone blonde hot boat lobby green funeral bridge flight outside blind scene no saloon
spider carnival troupe movie medical by older royal control air barber racetrack senior as ice theater pool card
gold war gas opera studio small hill hat year con class goer double square village food elderly ball bounty infected
sub college market council camp game traffic factory death press motorcycle neighborhood for artist posse angry
commissioner scorpion digger football service film scout controller drug group foreign brothel plane secondary
newsreel table museum guide speakeasy lab newspaper bully inquirer english suit third reader defense concierge
castle force up piano instructor booth background book tailor wounded subway elder homeless flower camera lead
dancing garden keeper crime banquet gate district hopper gladiator bunker hearing auction set center apartment
machine playing coffee circus hero sequence convention snake civilian motel dutch union dead waiting embassy
department hand bird barker unit masked committee race society law video eater go stagehand door mate ape fireman
fire tribunal golden strip eye grand meeting company newspaperman speaker match telephone translator pit metro three
palace shot buyer field years construction library prime raider counter front business baseball dispatcher crane
tower tough border hanging pub adult mob contestant fish national end investigator hobbit ring boxing middle patrol
swiss arresting matron cross dock crazy two secret escort jail ambulance drunken analyst pizza music science song
mouse tennis roof tall homme customs garage academy ex dream rehearsal gorilla under gala reading younger bass
conference kitchen guitar fisher an gym interrogator flashback coat mission track flying bath railroad shield wagon
concert interpreter ping commercial merry long horse hong haired united pinball core face parent spectre shaw box
paratrooper mill carabinieri crying bell cigarette gun bunny check ny innkeeper navy gallery main ghetto
superintendent lodge rev real out mo airline watching terrorist cute collector home window cigar screaming chico
fort ceremony times beautiful expert plant egyptian lycee appearance sentry pretty bad bearded enfant day play
magistrate vice yang wright supporter epilogue great cheerleader best sun estate kissing brunette silent island
plainclothesman bathroom overseer tavern ballroom cartel dark hunt wells moon section statehood evil celebration
newsman pa tree last featured human painter polish auctioneer nations alley parking stenographer carpenter eyes site
er committeewoman reception wang calf flagellant downtown cotton predator siamese bates companion water firefighter
aged soda wood armed pig rower newsreader astronaut nazi gates settler dragon yakuza woo veteran protestor
broadcaster peters campaign rodeo happy parade tour murder public adjutant brewster chick laughing stand shooter
morgue fashion jewelry hairdresser architect cast festival pike ling rep defence wiseguy pony porn production sing
suitor cult southern bald top banner plainclothes buzz montage body mall trial gray emergency inn sound trolley dong
potts drive silver committeeman parr mail smoking lounge character heckler advisor price parlor agency finch beauty
fuller railway associate pop padre space fair communications jury computer march warehouse cinema rebel screen
cabinet corridor aspiring composers lyricists copy presenter blond mad auto troll makeup west bike criminal sal
trumpet limo hungry counselor storyteller opening south representative golf corps health lin glasses pageant
ceremonies immigration emperor toots pullman deli cream beer enterprise ark terminated bootblack bo crow monkey
bookstore round half gestapo taker dining greeter autograph batman burly pickpocket road stagecoach coachman beaver
highway test hawker barrister animal left nobleman sheik viking fury dignitary dress lion bikini ufo elephant step
interviewee fagin large cell ming drum bag conspirator frat performance plaza intelligence headquarters walking
usherette projectionist diamonds sports forensic disciple bandleader tea rocket sad passport civil physician doll
post shopper mayan hulk op socialite luncheon tai hung corpse iron oh handler imperial dona motorbike emcee panther
skinny willy carver silva carrying sales leaving lost murderer fruit sweet that fake sen next command defendant
start east chambers light leg federal vulcan galley talking power boarding his bearer temple hogan cricket yankee
cowhand reaper server housewife chancellor cleve chow na amazon gook ah qin texas slim sidewalk cave hallway
commissaire newton caretaker pre yard lot laundry crash buying revolutionary rowdy cavalry disco stern administrator
or pal look motor flash arena graves undertaker tail specialist frost television rabbit anthrax balloon memorial
sweeper aka legionnaire classroom express bud violin auditorium ops beast fortune cock tracker crag university call
rally running pipe chaplain shoe weaver salt saxophone joker mistress squad handmaiden auntie mamma cap perkins
caller bull gamer god quint gossip chicken barista youngest action hardware nose garbage stock burns songwriter
blood underground be creepy fourth so vagrant curly potato tunnel super stunt north resistance congressman hard
medico subordinate yu waterbed climbing sherpa amah wild trench foley mulligan well political four rice berg glass
designer liquor tattoo nervous riot through mine newsstand country confederate shorty tram final soccer government
accountant salon brig brigadier centre winchester tube fountain massage mirror fencer mars hart hipster barn
traditional rifle fleeing oil strike runner tent legend metropolis mule quill visions soldado housemaid amiga
carabiniere charro deck shirt babe circle down fighting torso bomb parole insurance cafeteria spats paradise carmine
grimes friendly talk bat selling counsel masseuse naval commandant alcoholic dying block centurion zoo executioner
ministry holland forces starlet duck villain axe rand telegraph hatch tank hydra owl graduate contest listening tae
cantina morales po horseman bazaar seal darling wan raja guardsman trucker hicks eagle mercer chapman interview
sleeping blade blacksmith dans carrier peg record heavy hamlet crossing waiters ballerina moving soundman venture
duty scared examiner harmonica supermarket garner affairs wrestling armored ames liaison leading hale wall jeweler
warder hair petty magic he accident bicycle clinic bookie fairy baggage bed stoner wealthy ensign briefing
basketball backup antique banks pepper mover masters shrine farm motorist republican mandarin launch sang noh baba
noble cameo beard virgin jong strange land won cathedral bench recruiter drill sale governess laborer looking stall
billings knife saleslady geisha good drinking dodo fantasy pink love yellow timer vocalist marriage central woods
observer skull costume courthouse uniformed mime fowler file hooligan powers volunteer amigo hoss another opponent
partier comic project injured precinct rivers birdie pet birthday shoes rescue backstage draco dumbledore drugstore
boatman letter midget lone manicurist hired shuttle martini soviet nerd undercover fundamentalist surfer minion rat
maestro superior swimming my gi cobb bong nam checkpoint bison muir cyclist trumpeter trustee freak bene twelve kang
expedition workplace off sims pong cannibal time jogger personnel pinhead burning corsair frog uniform corrections
evacuee inventor cleaning cookie scum driving league infant gibbons colorado pen corner boot behind strong magazine
grocery mountain depot aardvark sombrero cable backer rental trick steps jailbird hook world pentagon balcony mask
convenience mummy newlywed brave eating lookout accordionist trailer monitor plummer interrogation lips radar
midnight number chariot friar bush robbins right cicero streetwalker hoover barge talbot drain birds ant getting
hoods journal hatcheck daddy skipper counterman program watcher cavalryman back michaels chino superman berlin
summers gamin gay guild dressed horn hammer shepherd freshman recorder bambi muller scavenger stop nation strolling
bracero rouge ja mako gardens khaki outrider yacht ki hon empire splatter possession templar disciples single burial
plot munchkin oaks commune eyed firing malibu palm carriage alliance arms flesh throwing helper sword flat fete
dopey shotgun roller flint mustache planetarium mermaid redneck seeker shadows autopsy rain skin contact her
technical pigeon coolie wandering dowager case juvenile doo debutante puppeteer naked organist county buttercup
broken bone yorker more battle poodle prophet stoker homicide electrician mib aliens marsh not bones hell wardrobe
toy skater faceless thin pan fast maiden sultan zealot bowers reeves hyena toad richter assembly tango publicity
apache brand saint lo international pup serrano bakery hun mere dice chin sanders spoon burlesque chevalier donut
alias courtesan sex target elementary lefty weapons fang pin martial shooting roma treat lung history mighty
screamer mailroom sumo churchgoer globe specialty trombone operations floating mal working en militia rogues spa
cyborg maleficent delta weasel sung sapper si festa pasha tin gill smiley seedy pompous psychiatric kaiser lemon pie
biff audition stable skeleton mar relative dell vault granddaughter tenement mort stairs bidder hermit murdered herb
clergyman asylum way busboy division maintenance barbershop roadhouse clem solicitor pharmacy worm sign flagstone
registrar bane dieter frantic rhino mental moss shocked channel key aid location postal sykes giggling colossus side
pope priestess burger bookseller finance course repairman longshoreman gatekeeper crown davies kibitzer med
accomplice quintet grave chez into polka haze mills striker cox peep shark rag chimpanzee publisher hustler photo
attacker vocals fishing carpetbagger roadblock arm informant yardbirds cutter foot realtor tactical concerned
cornerman depositor joint base watch barlow wolverine rape handwriting fisk flophouse benefit act airplane path dumb
chambermaid cemetery travel glee coast speed compound shoot guests coed leary scar during freeman expo kemp greek
contemporary interviews screening deuces shaman queens soul papal ami hardy evening former immigrant aviator
prentice meer pregnant bathhouse pond fiesta view ravager grande roll custom billiard protest hae orgy sik via
shantytown et taskmaster dory peach landowner bug babysitter seven short very wisher fa distinguished skinhead
scooter brick custodian bilbo cartwright ugly sexy baccarat cocktail prefect warsaw stockbroker tanker palladium
near bugle pickup sheldrake whitey howe wheeler commodore newsroom rioter partridge cattle gateman ronin trapped
bender sitting elegant dodge wine balladeer internal campus hag figure tor potential transvestite dom hitchhiker
woodcutter support daily chamberlain sunbather clock wrangler banjo muley agitator various puss slater tournament
solo colony flowers hands cello oak sea sloan baldy surveillance speaking donkey ogre religious make umbrella valley
hastings standing slinky sarge premiere roper riding clothes mini is demonstrator sewer phantom cold creep dialogue
ringside wainwright comrade thumper huge bricklayer veterinarian billows manchester hound rapist recording drinker
cabaret mole deserter ta used inquiry tribe whip mounted salesgirl stout ens shin suk lighting underling jun
creditor identification re lynch nat coffin entrance stretcher quail advocate magneto cyclops snowboarder mafia
sibling six paparazzi bodega taxidermist automated falcon geographer die merc mantis comms townsfolk apex toes
praetorian opossum paper peppy nim teahouse gong polis gump curran playground range sparrow gogo cutler helmsman
basement orphanage soap donny chorine coronation armless western petit yen blackjack doe moose archbishop communion
retirement kills cannon asking caterer distraught irate morning tow calling training care seminar carpet fund wing
jerk uncredited observatory investor sloth midge momma coordinator swimmer vega chanting saying promoter commanding
late bey hangman winder reg passer moderator drums shoulder inspection bookkeeper needles grip em consul majordomo
kayo glover stretch racer goyle portrait tender weathers hearts branch chemist poppet port purser boots charming
ground spokesman pathologist bugs cow cage impersonator managing detectives citizens derry thorpe salvage airfield
downstairs knocked wearing tub vulture kiev whose standard sparks parsons suicide life dollar nettie hansel goth
triad killed navigator graduation webster ten neanderthal curry pere spieler johns rejected exchange damned heart
sweeney bard swede comedy services prospective plumber beaters alpha effects plastic raid fields envoy talent
switchboard stein charge jiminy robbery questions askers dandy waterfront executor drama bearing taj weber bullock
nan enactments stylist ur entomologist tare cossack spode prologue it unemployed organ wheelchair serviceman bouche
pawn wooden par casting rogue mystique pi paddock rescued fille holiday burry sixer posh percussion looter
protection coronel partisan hombre octet greece detenu goo jass present situation qi shan raffle mezcal apartments
plying elephants descendant adolescent prayers barnier apostle squirt bubba headed topless parks expressman crippled
parrot spotter shadow headless transit sidekick guerilla bullet bomber smokey living swallower mystery dent
scarecrow grumpy tattooed shields marks regular defender passing landing century shaving future furniture toll fresh
tenor brothers vaudeville pinky chess sportscaster norm hearings rooster bullhorn skinner patch oriental gator
domino mysterious holt fingerprint puppet centaur poison handsome property pierrot horner barrow consultant free
towers brant popcorn snooty web eastern radioman camel hysterical paymaster townie hooper leper media cart discovery
dewitt lowe prop locksmith smuggler sketch gigolo comedian information lib pro desert filch lupin pumpkin couch
tangier ninja steel guru florist fitch lock hare invite waving dresser jive dirty after dickey smart rascal
financial roustabout ripper flea rink sunglasses jacket attacking map vegas attack milt nude mademoiselle sax zero
capitan jefe crack lackey nearby run shelter gal search moustache lizard ritter waldo maker peck rigger wig xi geek
shower social deranged condemned whore candidate roulette reform statue gunfighter thanksgiving junk wiener hatter
evacuation stockings platform browning operating regent ancient physical five pod ting whale sick prosecution tone
soon bassett mean minivan za`);
const BIT_CUT = BIT_SET("in at on with from of for by near outside inside behind under who that whose to into about without across");
const BIT_ORDINAL = /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|another|other|\d+(?:st|nd|rd|th))\b/;
// Whether a character, as TMDB writes it, is a bit part: every part of it ("Mr. Stein / Patron") one of the people there.
function bitPart(character) {
  const parts = String(character || "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").split(/\s*\/\s*/).filter((p) => /\p{L}/u.test(p));
  return parts.length > 0 && parts.every((part) => {
    const s = part.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (/^the\b/.test(s)) return false;
    const numbered = /#\s*\d+|\b\d+\b|\bno\.\s*\d+/.test(s) || BIT_ORDINAL.test(s);
    let words = s.replace(/'s\b/g, " ").replace(/\b\d+(?:st|nd|rd|th)\b|[#\d]+/g, " ").replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter((w) => w && w !== "a" && w !== "an");
    const cut = words.findIndex((w) => BIT_CUT.has(w)); // "Man in Black Suit": the man
    if (cut === 0) return false;
    if (cut > 0) words = words.slice(0, cut);
    words = words.filter((w) => !BIT_ORDINAL.test(w));
    if (!words.length || words.some((w) => w.length === 1 || w === "the" || !(BIT_PEOPLE.has(w) || BIT_ROLES.has(w) || BIT_WORDS.has(w)))) return false;
    const head = words[words.length - 1];
    return BIT_PEOPLE.has(head) || (numbered && BIT_ROLES.has(head));
  });
}
</script>
