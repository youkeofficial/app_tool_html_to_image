# CONTEXTE
application de génération d'image à partir de html
sera herger sur serveur linux (linux-server)
doit etre accessible via mcp
doit etre deployer via docker (ou portainer)

# CONFIGURATION
port: 5003
mcp port: 8004

# OUTILS
Generation d'image à partir de html (recois du html et retourne une image)
Generation de video, recois du html avec javascript et css (animation) et retourne de la video
Generation d'audio (avec choix de voix, langue, accent, ton, etc)
Possibilité de composer (video + audio) pour generer une video avec audio
Possibilite de generer des videos uniquement avec images et audio sur une durée
Pris en charger de webhook pour chaque action pour informer le client de la fin d'une operation
Expose les serveurs api (/api/vXXX) et le serveur mcp (/mcp)
Choix du language libre (le plus pertinent pour le projet)
Doit etre autonome et documenté

# CONTRAINTES
- doit etre deployer via docker (ou portainer)
- doit etre accessible via mcp
- doit etre deployer sur linux-server
- doit etre accessible via port 5003
- doit etre accessible via mcp port 8004