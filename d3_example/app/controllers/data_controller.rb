class DataController < ApplicationController
  

  # GET /data
  # GET /data.json
  def index
    

  end

 
# not being used
  def data
    @x = rand(10..100)
    @y = rand(10..100)
    respond_to do |format|
      format.json {  render json: [@x,@y]    }
    end
  end

end
