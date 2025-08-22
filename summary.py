import os
import sys

def generer_resume_repertoire(chemin_racine, fichier_sortie, fichiers_a_ignorer, extensions_a_ignorer, dossiers_a_ignorer, extensions_polices):
    """
    Parcourt un répertoire, écrit sa structure et le contenu des fichiers,
    mais écrit uniquement le nom des fichiers de police.

    :param chemin_racine: Le chemin du répertoire à analyser.
    :param fichier_sortie: Le nom du fichier texte où enregistrer le résumé.
    :param fichiers_a_ignorer: Une liste de noms de fichiers à ignorer.
    :param extensions_a_ignorer: Un tuple d'extensions de fichiers à ignorer.
    :param dossiers_a_ignorer: Une liste de noms de dossiers à ignorer.
    :param extensions_polices: Un tuple d'extensions de polices à traiter différemment.
    """
    try:
        with open(fichier_sortie, 'w', encoding='utf-8') as f_out:
            print(f"Analyse du répertoire : {chemin_racine}")
            f_out.write(f"Résumé du projet : {chemin_racine}\n")
            f_out.write("=" * (len(chemin_racine) + 20) + "\n\n")

            if not os.path.isdir(chemin_racine):
                message_erreur = f"ERREUR : Le chemin '{chemin_racine}' n'est pas un répertoire valide."
                print(message_erreur)
                f_out.write(message_erreur)
                return

            for dossier_actuel, sous_dossiers, fichiers in os.walk(chemin_racine):
                # Exclut les dossiers spécifiés pour que os.walk ne les parcoure pas.
                sous_dossiers[:] = [d for d in sous_dossiers if d not in dossiers_a_ignorer]

                profondeur = dossier_actuel.replace(chemin_racine, '').count(os.sep)
                indentation = ' ' * 4 * profondeur

                nom_dossier = os.path.basename(dossier_actuel)
                f_out.write(f"{indentation}Dossier : {nom_dossier}/\n")
                print(f"  -> Dans le dossier : {nom_dossier}/")

                indentation_fichier = ' ' * 4 * (profondeur + 1)
                
                fichiers.sort()

                for nom_fichier in fichiers:
                    if nom_fichier in fichiers_a_ignorer:
                        continue

                    if nom_fichier.lower().endswith(extensions_a_ignorer):
                        continue

                    chemin_complet_fichier = os.path.join(dossier_actuel, nom_fichier)
                    
                    # --- MODIFICATION CLÉ ---
                    # Vérifie si le fichier est une police d'écriture.
                    if nom_fichier.lower().endswith(extensions_polices):
                        # Si c'est une police, n'écrit que son nom et passe au suivant.
                        f_out.write(f"\n{indentation_fichier}Fichier (police) : {nom_fichier}\n")
                    else:
                        # Sinon, traite le fichier normalement en écrivant son contenu.
                        f_out.write(f"\n{indentation_fichier}Fichier : {nom_fichier}\n")
                        f_out.write(f"{indentation_fichier}{'-' * (len(nom_fichier) + 10)}\n")
                        
                        try:
                            with open(chemin_complet_fichier, 'r', encoding='utf-8', errors='ignore') as f_in:
                                contenu = f_in.read()
                                for ligne in contenu.splitlines():
                                    f_out.write(f"{indentation_fichier}  {ligne}\n")
                        except Exception as e:
                            f_out.write(f"{indentation_fichier}  --> ERREUR : Impossible de lire le contenu. Raison : {e}\n")
                        
                        f_out.write(f"{indentation_fichier}{'-' * (len(nom_fichier) + 10)}\n\n")

        print(f"\nRésumé terminé ! Le fichier '{fichier_sortie}' a été créé avec succès.")

    except Exception as e:
        print(f"Une erreur inattendue est survenue : {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Utilisation : py summary.py <chemin_vers_le_dossier>")
        sys.exit(1)
    
    chemin_du_projet = sys.argv[1]
    nom_du_fichier_resume = "summary.txt"
    
    # Listes d'éléments à ignorer
    fichiers_ignores = [nom_du_fichier_resume, "summary.py"]
    extensions_binaires_ignorees = ('.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp')
    
    # --- AJOUT IMPORTANT ---
    # Liste des dossiers à ignorer complètement
    dossiers_ignores = ['.git', '__pycache__', 'node_modules', '.wrangler', 'venv', '.vscode']
    
    # --- NOUVEAU ---
    # Liste des extensions de polices à traiter spécifiquement
    extensions_de_polices = ('.ttf', '.otf', '.woff', '.woff2')
    
    # Appelle la fonction principale pour générer le résumé
    generer_resume_repertoire(
        chemin_du_projet, 
        nom_du_fichier_resume, 
        fichiers_ignores, 
        extensions_binaires_ignorees, 
        dossiers_ignores,
        extensions_de_polices  # Nouvel argument
    )