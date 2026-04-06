import express from "express"
import prisma from "../prisma.js"
import { authRequired } from "../middleware/auth.js"

const router = express.Router()

router.patch("/:id/read", authRequired, async (req,res)=>{

  const note = await prisma.projectNote.update({
    where:{ id:req.params.id },
    data:{ read:true }
  })

  res.json(note)

})

export default router