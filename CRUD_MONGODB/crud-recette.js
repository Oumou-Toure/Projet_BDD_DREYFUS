//CREATE
db.recette.insertOne({
    productId: "42",
    ingredients: ["farine", "beurre", "sucre"],
    etapes: ["mélanger", "cuire 25 min à 180°C"],
    createdBy: "emma",
    createdAt: new Date()
})


//READ
db.recette.find({ productId: "42" }).sort({ createdAt: -1 })


//UPDATE
db.recette.updateOne(
    { productId: "42" },
    { $set: { createdBy: "emma.prime" }, $push: { ingredients: "œufs" } }
)

//DELETE
db.recette.deleteOne({ productId: "42" })

