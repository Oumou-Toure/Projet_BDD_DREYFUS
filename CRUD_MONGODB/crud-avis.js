//CREATE
db.avis.insertOne({
    productId: "42",
    clientId: "client_123",
    commentaire: "Excellent !",
    dateDePublication: new Date(),
    note: 5
})

//READ
db.avis.find({ productId: "42" }).sort({ dateDePublication: -1 })


//UPDATE
db.avis.findOne({ productId: "42" })


//DELETE
db.avis.deleteOne({ productId: "42"  })


