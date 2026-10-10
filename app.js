const dbName = 'dataJL';
const dbVersion = 1;
let db;

// ---- Ouverture de la base ----
const request = indexedDB.open(dbName, dbVersion);

request.onupgradeneeded = function (event) {
  db = event.target.result;

  // Table principale
  if (!db.objectStoreNames.contains('tbl_JL')) {
    const store = db.createObjectStore('tbl_JL', {
      keyPath: 'id',
      autoIncrement: true,
    });
    store.createIndex('nom', 'nom', { unique: false });
    store.createIndex('prenom', 'prenom', { unique: false });
    console.log('tbl_JL creation');
  }

  // Table de sauvegarde
  // if (!db.objectStoreNames.contains('tbl_Backup')) {
  //   const backupStore = db.createObjectStore('tbl_Backup', {
  //     keyPath: 'backupId',
  //     autoIncrement: true,
  //   });
  //   backupStore.createIndex('timestamp', 'timestamp', { unique: false });
  //   console.log('tbl_Backup creation');
  // }

  console.log('Base et table créée ou mise à jour');
};

request.onsuccess = function (event) {
  db = event.target.result;
  refreshTable();
};

request.onerror = function (event) {
  console.error("Erreur d'ouverture :", event.target.error);
};

// ---- Ajout via formulaire ----
document.getElementById('formPerson').addEventListener('submit', function (e) {
  e.preventDefault();
  const nom = document.getElementById('nom').value.trim();
  const prenom = document.getElementById('prenom').value.trim();
  if (nom && prenom) {
    addPerson(nom, prenom);
    this.reset();
  }
});

// ---- Ajout ----
function addPerson(nom, prenom) {
  const transaction = db.transaction('tbl_JL', 'readwrite');
  const store = transaction.objectStore('tbl_JL');
  store.add({ nom, prenom }).onsuccess = () => refreshTable();
}

// ---- Lecture ----
function refreshTable() {
  const tbody = document.querySelector('#tablePersons tbody');
  tbody.innerHTML = '';

  const transaction = db.transaction('tbl_JL', 'readonly');
  const store = transaction.objectStore('tbl_JL');
  store.getAll().onsuccess = (event) => {
    const persons = event.target.result;
    persons.forEach((person) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${person.id}</td>
        <td>${person.nom}</td>
        <td>${person.prenom}</td>
        <td>
          <button onclick="editPerson(${person.id}, '${person.nom}', '${person.prenom}')">Modifier</button>
          <button onclick="deletePerson(${person.id})">Supprimer</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };
}

// ---- Suppression ----
function deletePerson(id) {
  const transaction = db.transaction('tbl_JL', 'readwrite');
  const store = transaction.objectStore('tbl_JL');
  store.delete(id).onsuccess = () => refreshTable();
}

// ---- Modification ----
function editPerson(id, nom, prenom) {
  const nouveauNom = prompt('Nouveau nom :', nom);
  const nouveauPrenom = prompt('Nouveau prénom :', prenom);
  if (nouveauNom && nouveauPrenom) {
    const transaction = db.transaction('tbl_JL', 'readwrite');
    const store = transaction.objectStore('tbl_JL');
    store.get(id).onsuccess = (event) => {
      const data = event.target.result;
      data.nom = nouveauNom;
      data.prenom = nouveauPrenom;
      store.put(data).onsuccess = () => refreshTable();
    };
  }
}

// ---- Export JSON ----
function exportJSON() {
  const transaction = db.transaction('tbl_JL', 'readonly');
  const store = transaction.objectStore('tbl_JL');
  store.getAll().onsuccess = (event) => {
    const data = JSON.stringify(event.target.result, null, 2);
    downloadFile('dataJL.json', data, 'application/json');
  };
}

// ---- Export CSV ----
function exportCSV() {
  const transaction = db.transaction('tbl_JL', 'readonly');
  const store = transaction.objectStore('tbl_JL');
  store.getAll().onsuccess = (event) => {
    const persons = event.target.result;
    let csv = 'ID,Nom,Prénom\n';
    persons.forEach((p) => {
      csv += `${p.id},"${p.nom}","${p.prenom}"\n`;
    });
    downloadFile('dataJL.csv', csv, 'text/csv');
  };
}

// ---- Import JSON avec fusion et mise à jour ----
function importJSON() {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  if (!file) {
    alert('Veuillez sélectionner un fichier JSON.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) {
        alert('Fichier JSON invalide !');
        return;
      }

      // Lecture des enregistrements existants
      const transactionRead = db.transaction('tbl_JL', 'readonly');
      const storeRead = transactionRead.objectStore('tbl_JL');
      const getAllRequest = storeRead.getAll();

      getAllRequest.onsuccess = () => {
        const existing = getAllRequest.result;

        const transactionWrite = db.transaction('tbl_JL', 'readwrite');
        const storeWrite = transactionWrite.objectStore('tbl_JL');

        let added = 0;
        let updated = 0;

        data.forEach((item) => {
          const match = existing.find(
            (p) =>
              p.nom.toLowerCase() === item.nom.toLowerCase() &&
              p.prenom.toLowerCase() === item.prenom.toLowerCase()
          );

          if (match) {
            // Mise à jour de l'entrée existante
            const updatedEntry = { ...match, ...item };
            storeWrite.put(updatedEntry);
            updated++;
          } else {
            // Ajout d'une nouvelle entrée
            storeWrite.add({ nom: item.nom, prenom: item.prenom });
            added++;
          }
        });

        transactionWrite.oncomplete = () => {
          alert(`${added} ajout(s) et ${updated} mise(s) à jour effectuées.`);
          refreshTable();
          autoExportJSON(); // <-- export automatique
          // backupDataJL(); // sauvegarde automatique dans IndexedDB
          // listBackups();
          // loadBackups();
        };
      };

      getAllRequest.onerror = () => {
        alert('Erreur lors de la lecture des données existantes !');
      };
    } catch (err) {
      alert('Erreur de lecture du fichier JSON !');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ---- Export automatique après import ----
function autoExportJSON() {
  const transaction = db.transaction('tbl_JL', 'readonly');
  const store = transaction.objectStore('tbl_JL');
  const request = store.getAll();

  request.onsuccess = () => {
    const data = JSON.stringify(request.result, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Génère un nom de fichier unique avec date et heure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_dataJL_${timestamp}.json`;

    // Création du lien de téléchargement temporaire
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Export automatique effectué : ${filename}`);
  };

  request.onerror = () => {
    console.error("Erreur lors de l'export automatique !");
  };
}

// ---- Sauvegarde des données dans IndexedDB ----
// function backupDataJL() {
//   const transactionRead = db.transaction('tbl_JL', 'readonly');
//   const storeRead = transactionRead.objectStore('tbl_JL');
//   storeRead.getAll().onsuccess = (event) => {
//     const dataJL = event.target.result;

//     const transactionWrite = db.transaction('tbl_Backup', 'readwrite');
//     const storeBackup = transactionWrite.objectStore('tbl_Backup');

//     const backupEntry = {
//       timestamp: new Date().toISOString(),
//       data: dataJL,
//     };

//     storeBackup.add(backupEntry).onsuccess = () => {
//       console.log(
//         `Sauvegarde effectuée dans tbl_Backup (${backupEntry.timestamp})`
//       );
//     };
//   };
// }

// function listBackups() {
//   const transaction = db.transaction('tbl_Backup', 'readonly');
//   const store = transaction.objectStore('tbl_Backup');
//   store.getAll().onsuccess = (event) => {
//     console.log('Liste des sauvegardes :', event.target.result);
//   };
// }

// ---- Lister toutes les sauvegardes dans le select ----
// function loadBackups() {
//   const select = document.getElementById('backupSelect');
//   select.innerHTML =
//     '<option value="">-- Sélectionnez une sauvegarde --</option>';

//   const transaction = db.transaction('tbl_Backup', 'readonly');
//   const store = transaction.objectStore('tbl_Backup');

//   store.getAll().onsuccess = (event) => {
//     const backups = event.target.result;
//     backups.forEach((backup) => {
//       const option = document.createElement('option');
//       option.value = backup.backupId;
//       option.textContent = backup.timestamp;
//       select.appendChild(option);
//     });
//   };
// }

// ---- Vider la table ----
function clearTable() {
  if (!confirm('⚠️ Voulez-vous vraiment vider complètement la table ?')) return;

  const transaction = db.transaction('tbl_JL', 'readwrite');
  const store = transaction.objectStore('tbl_JL');
  const clearRequest = store.clear();

  clearRequest.onsuccess = () => {
    alert('Table vidée avec succès !');
    refreshTable();
  };

  clearRequest.onerror = (event) => {
    alert('Erreur lors du vidage de la table !');
    console.error(event.target.error);
  };
}

// ---- Téléchargement ----
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
