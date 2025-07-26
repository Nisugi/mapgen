# urchin guide
"30716": ";e true"

# portmaster
"11756": ";e multifput 'ask portmaster about travel 2','ask portmaster about travel 2';waitfor 'A crew member escorts you off the ship.'"

# go table
"29004": ";e table = \"ghost\"; fput \"go #{table} table\" if dothistimeout(\"go #{table} table\", 25, /You (?:and your group )?head over to|waves.*you.*(?:invites|inviting) you(?: and your group)? to (?:join|come sit at)/) =~ /inviting you|invites you/",

# quest transport
"26905": ";e 2.times{fput \"quest transport duskruin\"};UserVars.mapdb_duskruin_origin = 28908;"














  "wayto": {
    # cardinal direction
    "29034": "northeast",
    # non cardinal direction
    "28998": "go ladder",
    "28996": "go arch",
    # stringproc to go to a table
    "29004": ";e table = \"ghost\"; fput \"go #{table} table\" if dothistimeout(\"go #{table} table\", 25, /You (?:and your group )?head over to|waves.*you.*(?:invites|inviting) you(?: and your group)? to (?:join|come sit at)/) =~ /inviting you|invites you/",
    # stringproc to take portmaster boat ride
    "11756": ";e multifput 'ask portmaster about travel 2','ask portmaster about travel 2';waitfor 'A crew member escorts you off the ship.'",
    # stringproc for urchin guide (teleports)
    "30716": ";e true",
    # stringproc
    "3668": ";e Map[7].wayto['3668'].call;",
    # stringproc for pay events
    "26905": ";e 2.times{fput \"quest transport duskruin\"};UserVars.mapdb_duskruin_origin = 28908;",
    # stringproc to enter wizards guild
    "29773": ";e fput 'speak'; language = /You are currently speaking (.*?)\\./.match(get).captures.first until language;; fput('speak wizard') unless language == 'Guildspeak'; fput('unhide') if hidden? or invisible?; move 'say ::portal wizard'; fput('speak ' + language.to_s) unless language == 'Guildspeak'",
    # stringproc to enter rogue guild
    "18348": ";e fput 'look tool'; sleep 0.5; fput 'pull hoe'; waitrt?; fput 'pull rake'; waitrt?; fput 'pull shovel'; waitrt?; move 'go panel'"
    # stringproc to find a hidden exit
    "19213": ";e fput 'search'; move 'climb stair'",
    "17924": ";e multifput 'search', 'go passage'",
    "10434": ";e fput 'look barrel' ; move 'go chute'",
    "18348": ";e fput 'look tool'; sleep 0.5; fput 'pull hoe'; waitrt?; fput 'pull rake'; waitrt?; fput 'pull shovel'; waitrt?; move 'go panel'",
    # stringproc with cardinal direction that has roundtime (movement delay)
    "23265": ";e move 'northeast'; waitrt?",
  },



"wayto": {
    "29034": "northeast",
    "250": ";e multifput 'ask portmaster about travel 1','ask portmaster about travel 1';waitfor 'A crew member escorts you off the ship.'",
    "30716": ";e true",
    "11756": ";e multifput 'ask portmaster about travel 2','ask portmaster about travel 2';waitfor 'A crew member escorts you off the ship.'",
    "10838": ";e multifput 'ask portmaster about travel 3','ask portmaster about travel 3';waitfor 'A crew member escorts you off the ship.'",
    "1870": ";e multifput 'ask portmaster about travel 4','ask portmaster about travel 4';waitfor 'A crew member escorts you off the ship.'",
    "31493": ";e multifput 'ask portmaster about travel 6','ask portmaster about travel 6';waitfor 'A crew member escorts you off the ship.'",
    "32372": ";e multifput 'ask portmaster about travel 7','ask portmaster about travel 7';waitfor 'A crew member escorts you off the ship.'",
    "32928": ";e multifput 'ask portmaster about travel 8','ask portmaster about travel 8';waitfor 'A crew member escorts you off the ship.'"
  },

    "wayto": {
    "28813": "southwest",
    "28907": "south",
    "28935": "go wagon",
    "28937": "go ladder",
    "28871": "west",
    "28909": "east",
    "3668": ";e Map[7].wayto['3668'].call;",
    "30716": ";e true",
    "26905": ";e 2.times{fput \"quest transport duskruin\"};UserVars.mapdb_duskruin_origin = 28908;",
    "31558": ";e 2.times{fput \"quest transport ebon gate\"};UserVars.mapdb_ebon_gate_origin = 28908;"
  },