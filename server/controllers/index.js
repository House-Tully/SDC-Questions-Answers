var pool = require('../db');

module.exports = {

  getQuestions: function(req, res) {
    let count = req.query.count || 5;
    let page = req.query.page || 1;
    let offset = (page - 1) * count;
    let queryStr = `select question_id, question_body, to_timestamp(question_date/1000) as question_date, asker_name, question_helpfulness, reported,
    (select json_object_agg(
      answers.id, json_build_object(
        'id', id,
        'body',answer_body,
        'date', to_timestamp(answer_date/1000),
        'answerer_name', answerer_name,
        'helpfulness', question_helpfulness,
        'photos',(select coalesce( json_agg(
          json_build_object(
            'id', id,
            'url', pic_url)), '[]')
            as photos
            from photos
            where answer_id=answers.id)))
            as answers from answers
            where question_id=questions.question_id)
            from questions where product_id = $1 and reported=false limit $2 offset $3;`
    pool.query(queryStr,[req.query.product_id, count, offset])
    .then((data) => {
      let result = {
        "product_id": req.query.product_id,
        "results": data.rows
      }
      res.status(200).send(result);
    })
    .catch((err) => {
      console.log('error', err);
      res.status(500).send(err)
    })
  },

  getAnswerList: function(req, res) {
    let count = req.query.count || 5;
    let page = req.query.page || 1;
    let offset = (page - 1) * count;

    let queryStr = `(select id as answer_id, answer_body as body, to_timestamp(answer_date/1000) as date, answerer_name, question_helpfulness as helpfulness,(select coalesce(json_agg(
          json_build_object(
            'id', id,
            'url', pic_url)), '[]')
            as photos from photos
            where answer_id=answers.id ) from answers
            where question_id=$1 and reported=false limit $2  offset $3)`;
    pool.query(queryStr, [req.params.question_id, count, offset])
    .then( (data) => {
      let result = {
        "question": req.params.question_id,
        "page": req.query.page,
        "count": req.query.count,
        "results": data.rows
      }
      res.status(200).send(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send(err);
    })
  },

  postQuestion: function(req,res) {
    let queryStr = `insert into questions (product_id, question_body, question_date, asker_name, email, reported, question_helpfulness) values ($1, $2, extract(epoch from now())*1000, $3, $4, false, 0)`
    pool.query(queryStr, [req.body.product_id, req.body.body, req.body.name, req.body.email])
    .then((result) => {
      res.status(201).send('CREATED');
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send('could not post question')
    })
  },

  postAnswer: function(req,res) {

    let queryStr = `
    with answerID as (
      insert into answers ( question_id, answer_body, answer_date, answerer_name, answerer_email, reported, question_helpfulness)
      values ($1, $2, extract(epoch from now())*1000, $3, $4, false, 0)
      returning id
      )
      select id from answerID;`

    pool.query(queryStr, [req.params.question_id, req.body.body, req.body.name, req.body.email])
    .then( async (result) => {
      let photos = req.body.photos;
      await photos.forEach(photo => {
        let queryStr = `insert into photos(answer_id, pic_url)
          values($1, $2)`
        pool.query(queryStr, [result.rows[0].id, photo])})
    })
    .then((response) => {
      res.status(200).send('posted answer')
    })
    .catch((err) => {
      res.status(500).send('could not post answer')
    })
  },

  updateQHelpfulness: function(req, res) {
    let queryStr = `
    update questions
    set question_helpfulness = question_helpfulness + 1
    where question_id = $1 `

    pool.query(queryStr, [req.params.question_id])
    .then((result) => {
      res.status(204).send('updated helpfulness');
    })
    .catch((err) => {
      res.status(500).send('could not update helpfulness')
    })
  },

  updateQReport: function(req, res) {
    let queryStr = `
    update questions
    set reported = true
    where question_id = $1 `

    pool.query(queryStr, [req.params.question_id])
    .then((result) => {
      res.status(204).send('question is reported');
    })
    .catch((err) => {
      res.status(500).send('could not report question')
    })
  },

  updateAHelpfulness: function(req, res) {
    let queryStr = `
    update answers
    set question_helpfulness = question_helpfulness + 1
    where id = $1 `

    pool.query(queryStr, [req.params.answer_id])
    .then((result) => {
      res.status(204).send('updated helpfulness');
    })
    .catch((err) => {
      res.status(500).send('could not update helpfulness')
    })
  },

  updateAReport: function(req, res) {
    let queryStr = `
    update answers
    set reported = true
    where id = $1 `

    pool.query(queryStr, [req.params.answer_id])
    .then((result) => {
      res.status(204).send('answer is reported');
    })
    .catch((err) => {
      res.status(500).send('could not report answer')
    })
  }
}
